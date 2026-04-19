import { prisma } from '@/lib/db';
import { sendText, sendMedia } from '@/lib/uazapi';
import type { FollowupConfig, FollowupStep, Instance, KnowledgeDoc, Lead, Tenant } from '@prisma/client';

const FOLLOWUP_MODEL = 'gpt-4.1-mini';
const HISTORY_LIMIT = 30;

export type FollowupType =
  | 'reminder'
  | 'content'
  | 'social_proof'
  | 'proposal'
  | 'objection_break'
  | 'value_add'
  | 'breakup';

const TYPE_DIRECTIVE: Record<FollowupType, string> = {
  reminder: 'Retome o último ponto da conversa sem ser chato. Frase curta.',
  content: 'Compartilhe material relevante da KB. Se docId vier definido, use aquele documento.',
  social_proof: 'Cite caso real ou resultado do mesmo segmento. Sem exagero.',
  proposal: 'Ofereça algo concreto: reunião 15min, demo, diagnóstico.',
  objection_break: 'Antecipe objeção comum do segmento e desarme brevemente.',
  value_add: 'Insight útil ligado ao segmento, sem pedir nada de volta.',
  breakup: 'Última mensagem educada: vou parar de escrever por aqui, qualquer coisa me chama.',
};

function parseHHMM(s: string): { h: number; m: number } | null {
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, m: min };
}

function nowInTimezone(date: Date, timezone: string): { weekday: number; minutes: number } {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hour12: false,
    });
    const parts = fmt.formatToParts(date);
    const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const wdStr = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
    const hh = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
    const mm = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
    return { weekday: weekdayMap[wdStr] ?? 1, minutes: hh * 60 + mm };
  } catch {
    return { weekday: date.getUTCDay(), minutes: date.getUTCHours() * 60 + date.getUTCMinutes() };
  }
}

export function isWithinBusinessWindow(
  config: Pick<FollowupConfig, 'windowStart' | 'windowEnd' | 'activeDays' | 'timezone'>,
  date: Date = new Date()
): boolean {
  const { weekday, minutes } = nowInTimezone(date, config.timezone);
  if (!config.activeDays.includes(weekday)) return false;
  const start = parseHHMM(config.windowStart);
  const end = parseHHMM(config.windowEnd);
  if (!start || !end) return false;
  const startMin = start.h * 60 + start.m;
  const endMin = end.h * 60 + end.m;
  if (startMin >= endMin) return false;
  return minutes >= startMin && minutes < endMin;
}

function currentStep(
  config: FollowupConfig & { steps: FollowupStep[] },
  count: number
): FollowupStep | null {
  const sorted = [...config.steps].sort((a, b) => a.order - b.order);
  return sorted[count] ?? null;
}

export function computeNextFollowupAt(
  config: FollowupConfig & { steps: FollowupStep[] },
  nextCount: number,
  base: Date = new Date()
): Date | null {
  const step = currentStep(config, nextCount);
  if (!step) return null;
  if (nextCount >= config.maxCount) return null;
  const next = new Date(base.getTime() + step.delayDays * 24 * 60 * 60 * 1000);
  return next;
}

async function buildFollowupMessage(
  tenant: Tenant,
  lead: Lead,
  step: FollowupStep,
  position: { n: number; total: number },
  docs: KnowledgeDoc[]
): Promise<string | null> {
  if (!tenant.openaiApiKey) return null;

  const history = await prisma.message.findMany({
    where: { leadId: lead.id, tenantId: tenant.id },
    orderBy: { createdAt: 'asc' },
    take: HISTORY_LIMIT,
    select: { direction: true, body: true },
  });
  const transcript = history.length
    ? history.map((m) => `${m.direction === 'in' ? 'Lead' : 'Agente'}: ${m.body.slice(0, 200)}`).join('\n')
    : '(ainda sem histórico de conversa)';

  const kbBlock = docs.length
    ? docs
        .slice(0, 6)
        .map((d) => {
          const corpo = d.conteudoTexto?.trim().slice(0, 400) ?? '';
          const sendable = d.sendable && d.fileUrl ? ' [SENDABLE]' : '';
          return `- id=${d.id}${sendable} | ${d.titulo}${corpo ? `\n  ${corpo}` : ''}`;
        })
        .join('\n')
    : '(nenhum documento)';

  const type = step.type as FollowupType;
  const directive = TYPE_DIRECTIVE[type] ?? TYPE_DIRECTIVE.reminder;

  const persona = tenant.agentPersona?.trim() || `Você representa ${tenant.nomeEmpresa}.`;
  const system = `${persona}

Você é um SDR seguindo up um lead via WhatsApp. O lead não respondeu a última mensagem.
Esta é a tentativa ${position.n} de ${position.total} — quanto maior N, mais direto e menos insistente.

## EMPRESA
- Nome: ${tenant.nomeEmpresa}
- Oferece: ${tenant.produtosServicos ?? '(?)'}
- ICP: ${tenant.icp ?? '(?)'}
- Diferenciais: ${tenant.diferenciais ?? '(?)'}
- Proposta de valor: ${tenant.propostaValor ?? '(?)'}

## LEAD
- Empresa: ${lead.empresa ?? '(?)'}
- Nome: ${lead.firstName ?? '(?)'}
- Segmento: ${lead.especialidades ?? '(?)'}

## HISTÓRICO
${transcript}

## KB
${kbBlock}

## TIPO DE FOLLOW-UP: ${type}
${directive}
${step.customHint ? `\n## DIRETRIZ EXTRA DO USUÁRIO\n${step.customHint}` : ''}

## FORMATO
Retorne APENAS JSON: {"text": "mensagem curta"}.
- Máximo 180 caracteres.
- Não repita literalmente a última mensagem que você (agente) enviou.
- Capitalização natural. Sem emojis corporativos, sem "faz sentido", sem ladainha.
- Se não houver informação útil pra escrever, retorne {"text": ""}.`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tenant.openaiApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: FOLLOWUP_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Gere a mensagem de follow-up tipo "${type}".` },
        ],
        temperature: 0.6,
      }),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? '{}');
    const text = typeof parsed.text === 'string' ? parsed.text.trim() : '';
    if (!text) return null;
    const cleaned = text
      .replace(/\bfaz sentido\b/gi, 'te interessa')
      .replace(/\bfaria sentido\b/gi, 'interessa')
      .slice(0, 220);
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  } catch {
    return null;
  }
}

async function resolveInstance(tenantId: string, configInstanceId: string | null): Promise<Instance | null> {
  if (configInstanceId) {
    const inst = await prisma.instance.findFirst({ where: { id: configInstanceId, tenantId } });
    if (inst && inst.status === 'connected') return inst;
  }
  return prisma.instance.findFirst({
    where: { tenantId, status: 'connected' },
    orderBy: { createdAt: 'asc' },
  });
}

export async function sendFollowup(leadId: string): Promise<
  | { ok: true; skipped?: string }
  | { ok: false; reason: string }
> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      tenant: { include: { followupConfig: { include: { steps: true } } } },
    },
  });
  if (!lead) return { ok: false, reason: 'lead_not_found' };
  if (lead.interested) return { ok: true, skipped: 'interested' };
  if (lead.isDraft) return { ok: true, skipped: 'draft' };
  if (!lead.telefone) return { ok: false, reason: 'no_phone' };
  if (lead.followupManuallyPaused) return { ok: true, skipped: 'manually_paused' };

  const config = lead.tenant.followupConfig;
  if (!config || !config.enabled) return { ok: true, skipped: 'disabled' };
  if (lead.followupCount >= config.maxCount) return { ok: true, skipped: 'max_count' };

  const step = currentStep(config, lead.followupCount);
  if (!step) return { ok: true, skipped: 'no_step' };

  const instance = await resolveInstance(lead.tenantId, config.instanceId);
  if (!instance?.instanceToken) return { ok: false, reason: 'no_instance' };

  const docs = await prisma.knowledgeDoc.findMany({
    where: { tenantId: lead.tenantId },
    orderBy: { createdAt: 'asc' },
  });

  const type = step.type as FollowupType;
  const text = await buildFollowupMessage(lead.tenant, lead, step, { n: lead.followupCount + 1, total: config.maxCount }, docs);
  if (!text) return { ok: false, reason: 'ai_generation_failed' };

  const fixedDoc = step.docId ? docs.find((d) => d.id === step.docId && d.sendable && d.fileUrl) : null;

  try {
    await sendText(instance.instanceToken, lead.telefone, text);
  } catch (e) {
    return { ok: false, reason: `send_text_failed: ${e instanceof Error ? e.message : 'unknown'}` };
  }
  await prisma.message.create({
    data: {
      tenantId: lead.tenantId,
      leadId: lead.id,
      direction: 'out',
      body: text,
      toolCalled: `followup:${type}`,
    },
  });

  if (fixedDoc) {
    try {
      await sendMedia(instance.instanceToken, lead.telefone, fixedDoc.fileUrl!, {
        caption: '',
        type: (fixedDoc.fileType as 'document' | 'image' | 'video' | 'audio' | undefined) ?? 'document',
        fileName: fixedDoc.titulo,
      });
      await prisma.message.create({
        data: {
          tenantId: lead.tenantId,
          leadId: lead.id,
          direction: 'out',
          body: `[${fixedDoc.titulo}]`,
          mediaUrl: fixedDoc.fileUrl,
          mediaType: fixedDoc.fileType ?? 'document',
          toolCalled: `followup:${type}:doc`,
        },
      });
    } catch {
      // doc extra falhou, seguir
    }
  }

  const nextCount = lead.followupCount + 1;
  const nextAt =
    type === 'breakup' || nextCount >= config.maxCount
      ? null
      : computeNextFollowupAt(config, nextCount);

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      followupCount: nextCount,
      lastFollowupAt: new Date(),
      nextFollowupAt: nextAt,
      lastInteractionAt: new Date(),
    },
  });

  return { ok: true };
}

export async function resolveEligibleLeadIds(limit = 50): Promise<string[]> {
  const now = new Date();
  const rows = await prisma.lead.findMany({
    where: {
      isDraft: false,
      interested: false,
      followupManuallyPaused: false,
      nextFollowupAt: { not: null, lte: now },
      OR: [{ followupPausedUntil: null }, { followupPausedUntil: { lte: now } }],
      tenant: { followupConfig: { enabled: true } },
    },
    select: { id: true, tenantId: true, tenant: { select: { followupConfig: true } } },
    orderBy: { nextFollowupAt: 'asc' },
    take: limit * 3,
  });

  const eligible: string[] = [];
  for (const r of rows) {
    const cfg = r.tenant.followupConfig;
    if (!cfg) continue;
    if (isWithinBusinessWindow(cfg, now)) eligible.push(r.id);
    if (eligible.length >= limit) break;
  }
  return eligible;
}

export async function onLeadReplied(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, tenantId: true, tenant: { select: { followupConfig: true } } },
  });
  if (!lead) return;
  const cfg = lead.tenant.followupConfig;
  const hours = cfg?.pauseOnReplyHours ?? 48;
  const until = new Date(Date.now() + hours * 60 * 60 * 1000);
  await prisma.lead.update({
    where: { id: leadId },
    data: { followupPausedUntil: until, lastInteractionAt: new Date() },
  });
}

export async function onManualOutbound(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { tenant: { include: { followupConfig: { include: { steps: true } } } } },
  });
  if (!lead) return;
  const cfg = lead.tenant.followupConfig;
  const nextCount = lead.followupCount + 1;
  const nextAt =
    cfg && cfg.enabled && nextCount < cfg.maxCount
      ? computeNextFollowupAt(cfg, nextCount)
      : null;

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      followupCount: nextCount,
      lastFollowupAt: new Date(),
      nextFollowupAt: nextAt,
      lastInteractionAt: new Date(),
    },
  });
}

export async function scheduleFirstFollowup(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { tenant: { include: { followupConfig: { include: { steps: true } } } } },
  });
  if (!lead) return;
  const cfg = lead.tenant.followupConfig;
  if (!cfg || !cfg.enabled) return;
  if (lead.followupCount >= cfg.maxCount) return;
  const nextAt = computeNextFollowupAt(cfg, lead.followupCount);
  if (!nextAt) return;
  await prisma.lead.update({ where: { id: leadId }, data: { nextFollowupAt: nextAt } });
}
