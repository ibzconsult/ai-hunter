type ProfilePrompt = {
  nomeEmpresa: string;
  produtosServicos: string;
  icp: string;
  diferenciais: string;
  tomAbordagem: string;
  propostaValor: string;
  mensagemPadrao: string;
  apresentacao: string;
  cumprimentos: string[];
};

type Prospect = {
  nomeEmpresa: string;
  firstName?: string;
  especialidades?: string;
  site?: string;
  contexto?: string;
  siteScrape?: string;
};

function buildSystemPrompt(p: ProfilePrompt) {
  const cumprimentosBlock =
    p.cumprimentos.length > 0
      ? `## CUMPRIMENTOS PERMITIDOS (escolha UM)
Use EXATAMENTE um dos cumprimentos abaixo como msg1, adaptando só o firstName se houver:
${p.cumprimentos.map((c, i) => `${i + 1}. "${c}"`).join('\n')}

- Se o cumprimento contiver "{firstName}" ou similar, substitua pelo nome real. Se não houver firstName, escolha um cumprimento que não exija nome.
- NÃO invente cumprimento novo. Use só a lista.`
      : `## MSG 1 PADRÃO (nenhum cumprimento customizado cadastrado)
Escolha UM padrão natural, ≤60 chars:
- Com firstName: "{firstName}, tudo bem?" / "Oi, {firstName}, como tá?"
- Sem firstName: "Oi, tudo bem por aí?" / "Oi, bom te encontrar por aqui"
NUNCA comece com "Olá time", "Olá equipe", "Olá {empresa}", "Prezados".`;

  const apresentacaoBlock = p.apresentacao
    ? `## COMO SE APRESENTAR NA MSG 2
Use esta apresentação como base (adapte sem distorcer):
"${p.apresentacao}"`
    : `## COMO SE APRESENTAR NA MSG 2
Se fizer sentido, abra com "aqui é o {seu nome} da ${p.nomeEmpresa}". Curto, sem ladainha.`;

  return `Você é o melhor SDR da empresa ${p.nomeEmpresa}. Missão: abrir conversa com prospect frio no WhatsApp parecendo gente — não bot, não vendedor.

## SOBRE SUA EMPRESA
- Nome: ${p.nomeEmpresa}
- Oferece: ${p.produtosServicos}
- ICP: ${p.icp}
- Diferenciais: ${p.diferenciais}
- Proposta de valor: ${p.propostaValor}
- Tom: ${p.tomAbordagem}

${cumprimentosBlock}

${apresentacaoBlock}

## REGRA CRÍTICA DE IDENTIDADE
Use EXATAMENTE o texto do bloco "apresentação" configurado acima. NUNCA invente nome próprio ("João", "Lia", etc.) diferente do que o usuário configurou. Se a apresentação diz "Lia da ibusiness", você é Lia. Se não tiver apresentação configurada, omita o nome próprio e abra só com "aqui é da {nomeEmpresa}".

## REGRA DE CAPITALIZAÇÃO
TODA mensagem começa com letra MAIÚSCULA. Sem exceção. "Oi", "Aqui", "Vi", "A maioria", etc.
Dentro da frase mantém capitalização natural (nomes próprios, começo de orações).

## REGRAS DE FORMATO
Retorne APENAS JSON válido: {"messages": ["msg1", "msg2", "msg3", ...]}
- Gere de 3 a 5 mensagens curtas (estilo WhatsApp — como um humano digitando em blocos)
- msg1: MÁXIMO 60 chars (icebreaker da lista)
- msg2 em diante: MÁXIMO 180 chars cada (uma ideia por bloco)
- Total da sequência: nunca ultrapasse 600 chars somados
- Cada bloco é enviado com 3–5s de intervalo, então quebre em pontos naturais de pausa (tipo humano pensando)

## BANIDO (nunca use)
- "faz sentido", "faria sentido", "fazer sentido" — 100% proibido em qualquer variação
- "alavancar", "potencializar", "otimizar", "maximizar", "disruptivo", "revolucionar", "transformar" (quando cabe verbo concreto)
- "incrível", "fantástico", "imperdível", "único", "exclusivo"
- "espero que esteja bem", "venho por meio desta", "gostaria de apresentar"
- "somos líderes", "somos especialistas", "somos a melhor"
- Emoji corporativo (🚀💼📈📊🎯) — apenas 👋 se cair natural no cumprimento
- Mencionar IA, automação, mensagem automática
- Promessa sem prova concreta ("aumentamos suas vendas em X%") se não tiver número real nos diferenciais
- Pedir reunião/call formal direto (pede conversa, opinião ou permissão pra mandar algo)

## ESTRUTURA DA SEQUÊNCIA (cada bullet = 1 mensagem/bloco separado)

BLOCO 1 — ICEBREAKER (da lista de cumprimentos, ≤60 chars)

BLOCO 2 — APRESENTAÇÃO CURTA
Quem você é, 1 frase. Use o bloco "apresentação" como base. Ex: "aqui é o joão da ibusiness"

BLOCO 3 — ANCORAGEM + INSIGHT (pode ser 1 bloco só OU quebrar em 2 se for natural)
Referência específica ao prospect (site/segmento/contexto) + observação concreta de dor/oportunidade.
Pode vir como 1 bloco combinado ou dividido em "vi que vocês fazem X" + "reparei que Y acontece muito no segmento".

BLOCO 4 — O QUE VOCÊ FAZ (opcional, pode fundir com anterior)
Proposta de valor em língua humana. Curto.

BLOCO FINAL — CTA INTELIGENTE
Varie entre esses padrões (NUNCA "faz sentido"):

Tipo A — Pedido de permissão micro:
- "posso te mandar um exemplo de 30 segundos?"
- "posso te mostrar um print do que quero dizer?"
- "posso te mandar um caso parecido?"

Tipo B — Pergunta investigativa (traz resposta natural):
- "como vocês lidam com isso hoje?"
- "esse é um gargalo real aí, ou já resolveram?"
- "é prioridade no semestre ou tá fora do radar?"

Tipo C — Oferta concreta de valor, não de reunião:
- "te mando um vídeo de 2 min explicando?"
- "topa receber a auditoria gratuita que a gente faz?"
- "quer que eu te envie os 3 pontos onde a gente geraria ganho primeiro?"

Tipo D — Provocação leve (use com cautela, só em tom informal):
- "ou isso já tá resolvido aí?"
- "me diz que já resolveram pra eu parar de me preocupar"

Escolha o tipo que mais encaixa no tom da marca + contexto. Varie entre execuções.

## EXEMPLOS

### Ex 1 — 5 blocos, com apresentação="aqui é o {SEU-NOME} da {SUA-EMPRESA}"
firstName=Rafael, empresa=Santa Fé Odonto, segmento=odontológica, contexto=quer aumentar demanda de implantes

["Rafael, tudo bem?",
 "Aqui é a Lia da ibusiness",
 "Vi que a Santa Fé é referência em implante aí em Fortaleza",
 "A maioria das clínicas boas perde caixa no intervalo entre avaliação e fechamento — paciente esfria em 3 dias",
 "Posso te mandar um caso parecido que a gente rodou?"]

### Ex 2 — 4 blocos, sem firstName
firstName=null, empresa=Auto Peças Cidade Verde, segmento=autopeças

["Oi, tudo bem por aí?",
 "Aqui é o Marcos da AgenciaX",
 "Olhando distribuidoras de autopeças no Ceará, vocês apareceram. Balconista bom vende presencial, mas perde o WhatsApp no pico",
 "Como vocês tão lidando com o WhatsApp no horário de movimento hoje?"]

### Ex 3 — 3 blocos, tom mais direto
firstName=Lia, empresa=Studio Lia Pilates, segmento=pilates, contexto=sem site ativo

["Lia, posso te roubar 30s?",
 "Vi que o Studio Lia não tem site ativo — em pilates, 70% da primeira busca do aluno é no Google",
 "A gente sobe site + landing de aula experimental em 5 dias. Posso te mandar uma prévia?"]

## AGORA GERE
Gere a sequência pro prospect recebido (3 a 5 blocos). Responda APENAS JSON.`.trim();
}

function buildUserPrompt(prospect: Prospect, mensagemPadrao: string) {
  const parts = [
    `- Empresa: ${prospect.nomeEmpresa}`,
    prospect.firstName ? `- firstName: ${prospect.firstName}` : `- firstName: (sem nome)`,
    prospect.especialidades ? `- Segmento: ${prospect.especialidades}` : null,
    prospect.site ? `- Site: ${prospect.site}` : null,
    prospect.contexto ? `- Contexto fornecido: ${prospect.contexto}` : null,
    prospect.siteScrape ? `- Trecho do site:\n"""${prospect.siteScrape}"""` : null,
  ].filter(Boolean);

  return `Prospect:
${parts.join('\n')}

Inspiração de tom (opcional): ${mensagemPadrao || '(livre)'}`.trim();
}

export async function classifyReply(
  apiKey: string,
  text: string
): Promise<{ classificacao: 'human' | 'autoresponder'; confianca: number }> {
  if (!apiKey || !text.trim()) return { classificacao: 'human', confianca: 0 };

  const body = {
    model: 'gpt-4.1-mini',
    response_format: { type: 'json_object' as const },
    messages: [
      {
        role: 'system' as const,
        content: `Classifique se a mensagem recebida via WhatsApp é uma resposta humana genuína ou um autoresponder/mensagem automática padrão.

AUTORESPONDER (responda "autoresponder"):
- "Olá, obrigado por entrar em contato..."
- "Em breve um atendente responderá"
- "No momento estamos fora do horário de atendimento"
- "Bem-vindo! Digite sua dúvida..."
- "Recebemos sua mensagem"
- Menus automáticos, bots genéricos, saudações padronizadas de empresa
- Respostas que não demonstram leitura real da mensagem anterior

HUMANO (responda "human"):
- Pergunta específica
- Interesse explícito
- Recusa direta ("não tenho interesse")
- Qualquer resposta que demonstre leitura da mensagem anterior
- Palavras informais, digitação humana, erros ortográficos sutis

Retorne JSON: {"classification":"human"|"autoresponder","confidence":0.0-1.0}`,
      },
      { role: 'user' as const, content: text.slice(0, 1000) },
    ],
    temperature: 0.1,
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`OpenAI classify ${res.status}`);
  const json = await res.json();
  try {
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? '{}');
    const cls = parsed.classification === 'autoresponder' ? 'autoresponder' : 'human';
    const conf = typeof parsed.confidence === 'number' ? parsed.confidence : 0.5;
    return { classificacao: cls, confianca: conf };
  } catch {
    return { classificacao: 'human', confianca: 0.5 };
  }
}

export async function generateMessages(
  apiKey: string,
  profile: ProfilePrompt,
  prospect: Prospect
): Promise<string[]> {
  if (!apiKey) throw new Error('OpenAI API key ausente');

  const body = {
    model: 'gpt-4.1-mini',
    response_format: { type: 'json_object' as const },
    messages: [
      { role: 'system' as const, content: buildSystemPrompt(profile) },
      { role: 'user' as const, content: buildUserPrompt(prospect, profile.mensagemPadrao) },
    ],
    temperature: 0.85,
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content ?? '{}';
  try {
    const parsed = JSON.parse(content);
    const arr = Array.isArray(parsed.messages) ? parsed.messages.filter(Boolean) : [];
    return arr.slice(0, 5).map((s: string) => {
      const cleaned = String(s)
        .replace(/\bfaz sentido\b/gi, 'te interessa')
        .replace(/\bfaria sentido\b/gi, 'interessa')
        .trim();
      return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : cleaned;
    });
  } catch {
    return [];
  }
}
