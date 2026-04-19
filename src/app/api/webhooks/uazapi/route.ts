import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { classifyReply } from '@/lib/openai';
import { stageIdByType } from '@/lib/pipeline';
import { normalizePhone } from '@/lib/phone';
import { runAgentTurn } from '@/lib/agent';
import { onLeadReplied, onManualOutbound } from '@/lib/followup';
import { bumpScoreFromFreshMessage } from '@/lib/scoring';

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
  const isGroup = /@g\.us/i.test(rawPhone) || rawPhone.endsWith('@broadcast');
  const phone = normalizePhone(rawPhone.split('@')[0] ?? '');

  return { token, fromMe, text: String(text || '').trim(), phone, isGroup };
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });

  const { token, fromMe, text, phone, isGroup } = extractPayload(body);

  if (!text || !phone || !token || isGroup) {
    return NextResponse.json({ ok: true, skipped: 'irrelevant' });
  }

  const instance = await prisma.instance.findFirst({
    where: { instanceToken: token },
    include: { tenant: true },
  });
  if (!instance) return NextResponse.json({ ok: true, skipped: 'unknown instance' });

  let lead = await prisma.lead.findFirst({
    where: { tenantId: instance.tenantId, telefone: phone },
  });

  // fromMe=true: mensagem manual do operador via celular → conta como toque
  if (fromMe) {
    if (!lead) {
      return NextResponse.json({ ok: true, skipped: 'manual_out_unknown_lead' });
    }
    await prisma.message.create({
      data: {
        tenantId: instance.tenantId,
        leadId: lead.id,
        direction: 'out',
        body: text.slice(0, 4000),
        toolCalled: null,
      },
    });
    await onManualOutbound(lead.id);
    return NextResponse.json({ ok: true, manualOut: true });
  }

  // Lead novo: criar como draft (inbound)
  if (!lead) {
    const triageStage = await stageIdByType(instance.tenantId, 'triage');
    lead = await prisma.lead.create({
      data: {
        tenantId: instance.tenantId,
        telefone: phone,
        origem: 'inbound',
        isDraft: true,
        stageId: triageStage,
        respondeu: true,
        respondeuEm: new Date(),
        lastInteractionAt: new Date(),
        ultimaResposta: text.slice(0, 2000),
      },
    });
    await prisma.message.create({
      data: {
        tenantId: instance.tenantId,
        leadId: lead.id,
        direction: 'in',
        body: text.slice(0, 4000),
      },
    });
    await bumpScoreFromFreshMessage(lead.id).catch(() => {});
    return NextResponse.json({ ok: true, inbound: true, leadId: lead.id });
  }

  // Lead existente: classificar e gravar
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
    lastInteractionAt: new Date(),
  };

  if (classificacao === 'human') {
    updates.respondeu = true;
    updates.respondeuEm = new Date();

    if (!lead.isDraft) {
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
  }

  await Promise.all([
    prisma.lead.update({ where: { id: lead.id }, data: updates }),
    prisma.message.create({
      data: {
        tenantId: instance.tenantId,
        leadId: lead.id,
        direction: 'in',
        body: text.slice(0, 4000),
      },
    }),
  ]);

  if (classificacao === 'human' && !lead.isDraft) {
    await onLeadReplied(lead.id).catch(() => {});
    await bumpScoreFromFreshMessage(lead.id).catch(() => {});
  }

  let agentResult: { replies: string[]; toolsUsed: string[] } | null = null;
  if (instance.tenant.agentEnabled && classificacao === 'human' && !lead.isDraft) {
    try {
      const freshLead = await prisma.lead.findUnique({ where: { id: lead.id } });
      if (freshLead) {
        agentResult = await runAgentTurn(instance.tenant, freshLead, instance, text);
      }
    } catch (e) {
      console.error('[agent error]', e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({ ok: true, classificacao, confianca, agent: agentResult });
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'uazapi webhook' });
}
