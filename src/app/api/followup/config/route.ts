import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

const TYPES = ['reminder', 'content', 'social_proof', 'proposal', 'objection_break', 'value_add', 'breakup'];

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  const cfg = await prisma.followupConfig.findUnique({
    where: { tenantId: s.tenantId },
    include: { steps: { orderBy: { order: 'asc' } } },
  });
  return NextResponse.json({ ok: true, config: cfg });
}

type StepInput = {
  order?: number;
  delayDays?: number;
  type?: string;
  customHint?: string | null;
  docId?: string | null;
};

export async function PUT(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  const enabled = !!body.enabled;
  const maxCount = Math.max(1, Math.min(20, Number(body.maxCount ?? 4)));
  const windowStart = String(body.windowStart ?? '09:00');
  const windowEnd = String(body.windowEnd ?? '18:00');
  if (!/^\d{1,2}:\d{2}$/.test(windowStart) || !/^\d{1,2}:\d{2}$/.test(windowEnd)) {
    return NextResponse.json({ ok: false, error: 'janela_invalida' }, { status: 400 });
  }
  if (windowStart >= windowEnd) {
    return NextResponse.json({ ok: false, error: 'janela_cruza_meia_noite' }, { status: 400 });
  }
  const activeDays = Array.isArray(body.activeDays)
    ? body.activeDays.map(Number).filter((n: number) => n >= 0 && n <= 6)
    : [1, 2, 3, 4, 5];
  const timezone = String(body.timezone ?? 'America/Sao_Paulo');
  const pauseOnReplyHours = Math.max(0, Math.min(720, Number(body.pauseOnReplyHours ?? 48)));
  const instanceId = body.instanceId ? String(body.instanceId) : null;

  const rawSteps: StepInput[] = Array.isArray(body.steps) ? body.steps : [];
  const steps = rawSteps
    .map((st, i) => ({
      order: Number(st.order ?? i),
      delayDays: Math.max(1, Math.min(365, Number(st.delayDays ?? 2))),
      type: TYPES.includes(String(st.type)) ? String(st.type) : 'reminder',
      customHint: st.customHint ? String(st.customHint).slice(0, 1000) : null,
      docId: st.docId ? String(st.docId) : null,
    }))
    .sort((a, b) => a.order - b.order)
    .map((st, i) => ({ ...st, order: i }));

  const config = await prisma.followupConfig.upsert({
    where: { tenantId: s.tenantId },
    update: {
      enabled,
      maxCount,
      windowStart,
      windowEnd,
      activeDays,
      timezone,
      pauseOnReplyHours,
      instanceId,
    },
    create: {
      tenantId: s.tenantId,
      enabled,
      maxCount,
      windowStart,
      windowEnd,
      activeDays,
      timezone,
      pauseOnReplyHours,
      instanceId,
    },
  });

  await prisma.followupStep.deleteMany({ where: { configId: config.id } });
  if (steps.length > 0) {
    await prisma.followupStep.createMany({
      data: steps.map((st) => ({
        configId: config.id,
        order: st.order,
        delayDays: st.delayDays,
        type: st.type,
        customHint: st.customHint,
        docId: st.docId,
      })),
    });
  }

  const full = await prisma.followupConfig.findUnique({
    where: { id: config.id },
    include: { steps: { orderBy: { order: 'asc' } } },
  });
  return NextResponse.json({ ok: true, config: full });
}
