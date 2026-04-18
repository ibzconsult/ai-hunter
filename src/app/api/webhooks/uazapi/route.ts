import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { classifyReply } from '@/lib/openai';
import { stageIdByType } from '@/lib/pipeline';
import { normalizePhone } from '@/lib/phone';

function extractPayload(body: Record<string, unknown>) {
  const nested = (body.data ?? body.message ?? body) as Record<string, unknown>;
  const token =
    (body.token as string) ??
    (body.instanceToken as string) ??
    (nested.instanceToken as string) ??
    (nested.token as string) ??
    '';

  const fromMe =
    (nested.fromMe as boolean) ??
    (nested.fromme as boolean) ??
    ((nested.key as Record<string, unknown> | undefined)?.fromMe as boolean) ??
    false;

  const text =
    (nested.text as string) ??
    (nested.body as string) ??
    (nested.content as string) ??
    ((nested.message as Record<string, unknown> | undefined)?.conversation as string) ??
    '';

  const rawPhone =
    (nested.sender as string) ??
    (nested.from as string) ??
    (nested.phone as string) ??
    (nested.chatid as string) ??
    (nested.chatId as string) ??
    ((nested.key as Record<string, unknown> | undefined)?.remoteJid as string) ??
    '';
  const phone = normalizePhone(rawPhone.split('@')[0] ?? '');

  return { token, fromMe, text: String(text || '').trim(), phone };
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });

  const { token, fromMe, text, phone } = extractPayload(body);

  if (fromMe || !text || !phone || !token) {
    return NextResponse.json({ ok: true, skipped: 'irrelevant' });
  }

  const instance = await prisma.instance.findFirst({
    where: { instanceToken: token },
    include: { tenant: true },
  });
  if (!instance) return NextResponse.json({ ok: true, skipped: 'unknown instance' });

  const lead = await prisma.lead.findFirst({
    where: { tenantId: instance.tenantId, telefone: phone },
  });
  if (!lead) return NextResponse.json({ ok: true, skipped: 'lead not tracked' });

  let classificacao: 'human' | 'autoresponder' = 'human';
  let confianca = 0.5;
  if (instance.tenant.openaiApiKey) {
    try {
      const r = await classifyReply(instance.tenant.openaiApiKey, text);
      classificacao = r.classificacao;
      confianca = r.confianca;
    } catch {}
  }

  const updates: Record<string, unknown> = {
    ultimaResposta: text.slice(0, 2000),
    classificacao,
  };

  if (classificacao === 'human') {
    updates.respondeu = true;
    updates.respondeuEm = new Date();

    const repliedStage = await stageIdByType(instance.tenantId, 'replied');
    const contactedStage = await stageIdByType(instance.tenantId, 'contacted');
    const newStage = await stageIdByType(instance.tenantId, 'new');
    if (
      repliedStage &&
      (!lead.stageId || lead.stageId === contactedStage || lead.stageId === newStage)
    ) {
      updates.stageId = repliedStage;
    }
  }

  await prisma.lead.update({ where: { id: lead.id }, data: updates });

  return NextResponse.json({ ok: true, classificacao, confianca });
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'uazapi webhook' });
}
