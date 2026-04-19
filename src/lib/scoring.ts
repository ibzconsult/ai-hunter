import { prisma } from '@/lib/db';
import type { Lead, Message } from '@prisma/client';

export type Band = 'cold' | 'warm' | 'hot' | 'interested';

export type Signal = {
  type: string;
  weight: number;
  matchedAt: string;
  excerpt: string;
};

type SignalRule = { re: RegExp; type: string; weight: number };

const SIGNAL_RULES: SignalRule[] = [
  { re: /\bpre[çc]o|or[çc]amento|quanto custa|valor\b/i, type: 'price_ask', weight: 20 },
  { re: /\bdemo|reuni[aã]o|apresenta[çc][aã]o|call\b/i, type: 'demo_ask', weight: 30 },
  { re: /\bmaterial|portf[oó]lio|folder|apresenta[çc][aã]o\b/i, type: 'material_ask', weight: 15 },
  { re: /\btopa|quero|bora|fechado|vamos\b/i, type: 'positive_signal', weight: 25 },
  { re: /\bn[aã]o tenho interesse|pare\b|remover|descadastr/i, type: 'opt_out', weight: -100 },
  { re: /\bquando|prazo|urgente|hoje|amanh[aã]\b/i, type: 'urgency', weight: 15 },
];

const CACHE_TTL_MS = 5 * 60 * 1000;
const HISTORY_LIMIT = 30;

export function bandFromScore(score: number): Band {
  if (score >= 86) return 'interested';
  if (score >= 61) return 'hot';
  if (score >= 31) return 'warm';
  return 'cold';
}

function excerpt(body: string): string {
  return body.length > 120 ? `${body.slice(0, 117)}...` : body;
}

export function extractSignals(
  messages: Pick<Message, 'direction' | 'body' | 'createdAt'>[]
): { sum: number; signals: Signal[] } {
  const signals: Signal[] = [];
  const incoming = messages.filter((m) => m.direction === 'in');

  for (const msg of incoming) {
    for (const rule of SIGNAL_RULES) {
      if (rule.re.test(msg.body)) {
        signals.push({
          type: rule.type,
          weight: rule.weight,
          matchedAt: msg.createdAt.toISOString(),
          excerpt: excerpt(msg.body),
        });
      }
    }
  }

  // Engajamento alto: 3+ msgs em ≤5min
  for (let i = 2; i < incoming.length; i++) {
    const window = incoming[i].createdAt.getTime() - incoming[i - 2].createdAt.getTime();
    if (window <= 5 * 60 * 1000) {
      signals.push({
        type: 'high_engagement',
        weight: 10,
        matchedAt: incoming[i].createdAt.toISOString(),
        excerpt: excerpt(incoming[i].body),
      });
      break;
    }
  }

  const sum = signals.reduce((a, s) => a + s.weight, 0);
  return { sum, signals: signals.slice(-20) };
}

export async function aiReviewScore(
  apiKey: string,
  lead: Pick<Lead, 'empresa' | 'firstName'>,
  messages: Pick<Message, 'direction' | 'body'>[]
): Promise<{ score: number; reasoning: string } | null> {
  if (!apiKey) return null;
  const transcript = messages
    .slice(-20)
    .map((m) => `${m.direction === 'in' ? 'Lead' : 'Agente'}: ${m.body.slice(0, 200)}`)
    .join('\n');

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Avalie o interesse de um lead B2B com base no histórico. Retorne JSON: {"score": 0-100, "reasoning": "<=120 chars"}.
Sinais positivos: perguntas sobre produto/preço, pedidos de material/demo, entusiasmo, urgência, respostas rápidas.
Sinais negativos: recusa, sumiço, tom frio, desinteresse explícito.
Nunca retorne 100 a menos que o lead disse "quero fechar/contratar" literalmente.`,
          },
          { role: 'user', content: `Lead: ${lead.empresa ?? '?'} — ${lead.firstName ?? '?'}\n\n${transcript || '(sem histórico)'}` },
        ],
        temperature: 0.2,
      }),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? '{}');
    const raw = typeof parsed.score === 'number' ? parsed.score : 0;
    const score = Math.max(0, Math.min(100, Math.round(raw)));
    const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning.slice(0, 140) : '';
    return { score, reasoning };
  } catch {
    return null;
  }
}

export async function recomputeScore(
  leadId: string,
  opts: { force?: boolean } = {}
): Promise<{ score: number; band: Band; signals: Signal[] } | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      tenantId: true,
      empresa: true,
      firstName: true,
      interestUpdatedAt: true,
      interested: true,
      contact: { select: { firstName: true } },
      company: { select: { nome: true } },
    },
  });
  if (!lead) return null;
  const effectiveEmpresa = lead.company?.nome ?? lead.empresa;
  const effectiveFirstName = lead.contact?.firstName ?? lead.firstName;

  if (
    !opts.force &&
    lead.interestUpdatedAt &&
    Date.now() - lead.interestUpdatedAt.getTime() < CACHE_TTL_MS
  ) {
    return null;
  }

  const [tenant, messages] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: lead.tenantId }, select: { openaiApiKey: true } }),
    prisma.message.findMany({
      where: { leadId },
      orderBy: { createdAt: 'asc' },
      take: HISTORY_LIMIT,
      select: { direction: true, body: true, createdAt: true },
    }),
  ]);

  const { sum, signals } = extractSignals(messages);
  const ai = tenant?.openaiApiKey
    ? await aiReviewScore(
        tenant.openaiApiKey,
        { empresa: effectiveEmpresa, firstName: effectiveFirstName },
        messages
      )
    : null;

  // Combina: média ponderada 60% IA + 40% sinais (se IA disponível). Se não, só sinais.
  const signalScore = Math.max(0, Math.min(100, sum));
  const final = ai
    ? Math.max(0, Math.min(100, Math.round(ai.score * 0.6 + signalScore * 0.4)))
    : signalScore;
  const band = bandFromScore(final);

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      interestScore: final,
      interestBand: band,
      interestSignals: signals as unknown as object,
      interestUpdatedAt: new Date(),
    },
  });

  return { score: final, band, signals };
}

export async function bumpScoreFromFreshMessage(leadId: string): Promise<void> {
  // Força recompute ignorando cache quando a msg é recém-recebida
  await recomputeScore(leadId, { force: true });
}
