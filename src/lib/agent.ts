import { prisma } from '@/lib/db';
import { sendText, sendMedia } from '@/lib/uazapi';
import { stageIdByType } from '@/lib/pipeline';
import { resolveOpportunityParties } from '@/lib/crm';
import type { Tenant, Lead, Instance, KnowledgeDoc, Contact, Company } from '@prisma/client';

const MODEL = 'gpt-4.1';
const MAX_TURNS = 6;
const HISTORY_LIMIT = 30;

type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

type ToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

type AgentResult = { replies: string[]; toolsUsed: string[] };

const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'replyText',
      description: 'Envia uma mensagem de texto para o lead via WhatsApp. Use blocos curtos (≤180 chars).',
      parameters: {
        type: 'object',
        properties: { text: { type: 'string', description: 'Texto a enviar (≤180 chars).' } },
        required: ['text'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'sendDocument',
      description:
        'Envia um documento/material da knowledge base para o lead. Use quando o lead pede mais detalhes, exemplo, portfolio ou material concreto.',
      parameters: {
        type: 'object',
        properties: {
          docId: { type: 'string', description: 'ID do KnowledgeDoc do catálogo disponível.' },
          captionShort: { type: 'string', description: 'Legenda curta (opcional, ≤120 chars).' },
        },
        required: ['docId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'notifyOwner',
      description:
        'Notifica o dono via WhatsApp quando o lead demonstra interesse claro: pediu orçamento, demo, reunião, ou prazo de fechamento. Marca lead como interested=true.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Por que o lead é interessante agora (1 frase).' },
          summary: { type: 'string', description: 'Resumo da conversa até aqui (≤200 chars).' },
        },
        required: ['reason', 'summary'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'markStage',
      description: 'Move o lead de estágio no pipeline.',
      parameters: {
        type: 'object',
        properties: {
          stage: { type: 'string', enum: ['replied', 'won', 'lost'] },
        },
        required: ['stage'],
        additionalProperties: false,
      },
    },
  },
];

function buildSystemPrompt(
  tenant: Tenant,
  lead: Lead & { contact?: Contact | null; company?: Company | null },
  docs: KnowledgeDoc[],
  mode: 'inbound_first' | 'continuation'
): string {
  const parties = resolveOpportunityParties(lead);
  const persona = tenant.agentPersona?.trim() || `Você representa ${tenant.nomeEmpresa}. Tom: ${tenant.tomAbordagem}.`;

  const guardrailsBlock = tenant.agentGuardrails?.trim()
    ? `\n## GUARDRAILS OBRIGATÓRIOS (definidos pelo usuário)\n${tenant.agentGuardrails.trim()}\n\nEstas regras são INEGOCIÁVEIS. Se uma diretriz abaixo conflita com elas, obedeça às guardrails.`
    : '';

  const ctas = [tenant.agentCta1, tenant.agentCta2, tenant.agentCta3]
    .map((c) => c?.trim())
    .filter((c): c is string => !!c);
  const ctaBlock = ctas.length
    ? `\n## CTA DESTA RODADA\nUse como CTA quando for fechar o turno (adapte natural, mas mantenha a ideia):\n"${ctas[Math.floor(Math.random() * ctas.length)]}"`
    : '';
  const kbBlock = docs.length
    ? docs
        .map((d) => {
          const corpo = d.conteudoTexto?.trim().slice(0, 1200) ?? '';
          const sendable = d.sendable && d.fileUrl ? ' [SENDABLE]' : '';
          return `- id=${d.id}${sendable} | ${d.titulo}${d.descricao ? ` — ${d.descricao}` : ''}${corpo ? `\n  Conteúdo: ${corpo}` : ''}`;
        })
        .join('\n')
    : '(nenhum documento cadastrado)';

  const modeBlock =
    mode === 'inbound_first'
      ? `Esta é a PRIMEIRA mensagem do lead — ele(a) procurou sua empresa (inbound). Você ainda não sabe nada sobre o negócio dele(a). Sua missão nesta rodada:
1. Cumprimentar de forma natural.
2. Se a empresa tem "inboundGreeting" configurado, siga aquele tom como abertura.
3. Apresentar ${tenant.nomeEmpresa} em UMA frase curta (quem somos, o que fazemos).
4. Fazer 1 pergunta qualificadora pra entender o que levou o lead até você (ex: "posso perguntar o que te trouxe aqui?" ou "conta rapidinho o que você tá buscando?").
5. NÃO empurre venda nem preço agora — primeiro entender a dor.
6. Só chame notifyOwner se o lead já pediu explicitamente "quero fechar", "quero contratar" ou passou dado claro de urgência.

${tenant.inboundGreeting ? `Referência de abertura do usuário: "${tenant.inboundGreeting}"` : ''}`
      : `Você está dando continuidade a uma conversa que JÁ COMEÇOU. O lead acabou de responder. Sua tarefa: continuar de forma natural — não bot, não vendedor empolgado.`;

  return `${persona}
${guardrailsBlock}${ctaBlock}

${modeBlock}

## SOBRE A EMPRESA
- Nome: ${tenant.nomeEmpresa}
- Oferece: ${tenant.produtosServicos ?? '(?)'}
- ICP: ${tenant.icp ?? '(?)'}
- Diferenciais: ${tenant.diferenciais ?? '(?)'}
- Proposta de valor: ${tenant.propostaValor ?? '(?)'}

## SOBRE O LEAD ATUAL
- Empresa: ${parties.company?.nome ?? '(?)'}
- Nome: ${parties.contact?.firstName ?? '(?)'}
- Segmento: ${parties.company?.segmento ?? '(?)'}
- Site: ${parties.company?.site ?? '(?)'}
- Contexto inicial: ${lead.contexto ?? '(?)'}

## DOCUMENTOS DISPONÍVEIS (knowledge base)
${kbBlock}

## SUAS FERRAMENTAS (tools)
- replyText({ text }) — envia mensagem ao lead. Use vários replyText em sequência se quiser quebrar em blocos curtos.
- sendDocument({ docId, captionShort? }) — só funciona em docs marcados [SENDABLE]. Use quando o lead pede material concreto.
- notifyOwner({ reason, summary }) — chame quando o lead pediu orçamento, demo, reunião, prazo, ou disse "topa", "quero", "manda mais", "como é o preço".
- markStage({ stage: 'replied' | 'won' | 'lost' }) — só use 'lost' se o lead recusou explicitamente.

## REGRAS
- Sempre use replyText pelo menos uma vez por turno (responder o lead é o mínimo).
- Não invente dados que não estejam acima. Se o lead perguntar algo fora da KB, diga "vou checar com a equipe e te retorno" e chame notifyOwner.
- Mensagens curtas (≤180 chars cada). Evite parágrafos longos.
- Banido: "faz sentido", "potencializar", "maximizar", "alavancar", emojis corporativos (🚀💼📈), "espero que esteja bem", "venho por meio desta", "somos líderes/especialistas".
- Capitalização: toda mensagem começa com maiúscula.
- Não prometa prazo, preço fechado, ou resultado garantido sem dado da KB.
- Se o lead recusou educadamente: agradeça brevemente, chame markStage('lost') e pare.
- Se o lead demonstrou interesse claro (orçamento, demo, prazo): responda com replyText, chame sendDocument se houver material adequado, e SEMPRE chame notifyOwner.

## FORMATO
Você opera em turnos de tool calling. Faça quantas chamadas quiser na mesma rodada (replyText + sendDocument + notifyOwner é OK). Quando terminar, simplesmente não chame mais tools.`;
}

function loadHistory(messages: { direction: string; body: string; toolCalled: string | null; mediaUrl: string | null }[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const m of messages) {
    if (m.direction === 'in') {
      out.push({ role: 'user', content: m.body });
    } else {
      const note = m.mediaUrl ? `[doc enviado: ${m.mediaUrl}] ${m.body}` : m.body;
      out.push({ role: 'assistant', content: note });
    }
  }
  return out;
}

async function callOpenAI(apiKey: string, messages: ChatMessage[]): Promise<{ message: ChatMessage; finish: string }> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: TOOLS,
      temperature: 0.5,
    }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`OpenAI agent ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const choice = json.choices?.[0];
  return { message: choice?.message as ChatMessage, finish: choice?.finish_reason ?? '' };
}

function safeParse<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export async function runAgentTurn(
  tenant: Tenant,
  lead: Lead,
  instance: Instance,
  incomingText: string
): Promise<AgentResult> {
  if (lead.isDraft) return { replies: [], toolsUsed: [] };
  if (!tenant.openaiApiKey) throw new Error('OpenAI key ausente');
  if (!instance.instanceToken) throw new Error('Instance sem token');
  const token = instance.instanceToken;

  const leadWithParties = await prisma.lead.findUnique({
    where: { id: lead.id },
    include: { contact: true, company: true },
  });
  if (!leadWithParties) throw new Error('Lead não encontrado');
  const targetPhone = leadWithParties.contact?.phone ?? leadWithParties.telefone;
  if (!targetPhone) throw new Error('Lead sem telefone');

  const [history, docs] = await Promise.all([
    prisma.message.findMany({
      where: { leadId: lead.id, tenantId: tenant.id },
      orderBy: { createdAt: 'asc' },
      take: HISTORY_LIMIT,
      select: { direction: true, body: true, toolCalled: true, mediaUrl: true },
    }),
    prisma.knowledgeDoc.findMany({ where: { tenantId: tenant.id }, orderBy: { createdAt: 'asc' } }),
  ]);

  const hasPriorOut = history.some((h) => h.direction === 'out');
  const mode: 'inbound_first' | 'continuation' = !hasPriorOut && lead.origem === 'inbound'
    ? 'inbound_first'
    : 'continuation';

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(tenant, leadWithParties, docs, mode) },
    ...loadHistory(history),
    { role: 'user', content: incomingText },
  ];

  const replies: string[] = [];
  const toolsUsed: string[] = [];
  let replyTextCount = 0;
  const toolCounts: Record<string, number> = {};

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const { message, finish } = await callOpenAI(tenant.openaiApiKey, messages);
    messages.push(message);

    const toolCalls = message.role === 'assistant' ? message.tool_calls ?? [] : [];
    if (finish === 'stop' || toolCalls.length === 0) break;

    let stopAfter = false;
    for (const tc of toolCalls) {
      const name = tc.function.name;
      toolCounts[name] = (toolCounts[name] ?? 0) + 1;
      toolsUsed.push(name);

      let toolResult = 'ok';

      try {
        if (name === 'replyText') {
          const args = safeParse<{ text?: string }>(tc.function.arguments) ?? {};
          const text = (args.text ?? '').trim();
          if (text) {
            await sendText(token, targetPhone, text);
            await prisma.message.create({
              data: {
                tenantId: tenant.id,
                leadId: lead.id,
                direction: 'out',
                body: text,
                toolCalled: 'replyText',
              },
            });
            replies.push(text);
            replyTextCount++;
          } else {
            toolResult = 'erro: texto vazio';
          }
        } else if (name === 'sendDocument') {
          const args = safeParse<{ docId?: string; captionShort?: string }>(tc.function.arguments) ?? {};
          const doc = docs.find((d) => d.id === args.docId);
          if (!doc) {
            toolResult = 'erro: docId não encontrado';
          } else if (!doc.sendable || !doc.fileUrl) {
            toolResult = 'erro: doc não é sendable ou sem fileUrl';
          } else {
            const caption = (args.captionShort ?? '').slice(0, 120);
            await sendMedia(token, targetPhone, doc.fileUrl, {
              caption,
              type: (doc.fileType as 'document' | 'image' | 'video' | 'audio' | undefined) ?? 'document',
              fileName: doc.titulo,
            });
            await prisma.message.create({
              data: {
                tenantId: tenant.id,
                leadId: lead.id,
                direction: 'out',
                body: caption || `[${doc.titulo}]`,
                mediaUrl: doc.fileUrl,
                mediaType: doc.fileType ?? 'document',
                toolCalled: 'sendDocument',
              },
            });
            toolResult = `enviado: ${doc.titulo}`;
          }
        } else if (name === 'notifyOwner') {
          const args = safeParse<{ reason?: string; summary?: string }>(tc.function.arguments) ?? {};
          const reason = (args.reason ?? '').trim();
          const summary = (args.summary ?? '').trim().slice(0, 200);
          if (!tenant.notificationPhone) {
            toolResult = 'erro: notificationPhone não configurado';
          } else {
            const alert = `🔔 Lead interessado: ${leadWithParties.company?.nome ?? leadWithParties.contact?.firstName ?? targetPhone}\nMotivo: ${reason}\nResumo: ${summary}`;
            await sendText(token, tenant.notificationPhone, alert);
            await prisma.lead.update({
              where: { id: lead.id },
              data: {
                interested: true,
                interestScore: 100,
                interestBand: 'interested',
                interestUpdatedAt: new Date(),
                nextFollowupAt: null,
              },
            });
            await prisma.message.create({
              data: {
                tenantId: tenant.id,
                leadId: lead.id,
                direction: 'out',
                body: `[notify] ${reason} — ${summary}`,
                toolCalled: 'notifyOwner',
              },
            });
            toolResult = 'dono notificado';
          }
        } else if (name === 'markStage') {
          const args = safeParse<{ stage?: 'replied' | 'won' | 'lost' }>(tc.function.arguments) ?? {};
          const stage = args.stage;
          if (!stage) {
            toolResult = 'erro: stage ausente';
          } else {
            const stageId = await stageIdByType(tenant.id, stage);
            if (stageId) {
              await prisma.lead.update({ where: { id: lead.id }, data: { stageId } });
              toolResult = `stage=${stage}`;
              if (stage === 'lost') stopAfter = true;
            } else {
              toolResult = `erro: stage ${stage} inexistente`;
            }
          }
        } else {
          toolResult = `erro: tool ${name} desconhecida`;
        }
      } catch (e) {
        toolResult = `erro: ${e instanceof Error ? e.message : 'desconhecido'}`;
      }

      messages.push({ role: 'tool', tool_call_id: tc.id, content: toolResult });
    }

    if (stopAfter) break;
    if ((toolCounts.replyText ?? 0) === 0 && turn >= 2) {
      if (tenant.notificationPhone) {
        await sendText(
          token,
          tenant.notificationPhone,
          `🔔 Agente travado no lead ${leadWithParties.company?.nome ?? targetPhone}: 3 turns sem replyText. Assuma a conversa.`
        ).catch(() => {});
      }
      break;
    }
    if (Object.values(toolCounts).some((c) => c >= 3)) break;
  }

  if (replyTextCount === 0 && tenant.notificationPhone) {
    await sendText(
      token,
      tenant.notificationPhone,
      `🔔 Agente não conseguiu responder o lead ${leadWithParties.company?.nome ?? targetPhone}. Mensagem recebida: "${incomingText.slice(0, 200)}"`
    ).catch(() => {});
  }

  return { replies, toolsUsed };
}
