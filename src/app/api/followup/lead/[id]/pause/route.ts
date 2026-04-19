import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

type Params = Promise<{ id: string }>;

export async function POST(req: NextRequest, ctx: { params: Params }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const paused = typeof body.paused === 'boolean' ? body.paused : null;

  const existing = await prisma.lead.findFirst({ where: { id, tenantId: s.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

  const next = paused === null ? !existing.followupManuallyPaused : paused;
  const lead = await prisma.lead.update({
    where: { id },
    data: { followupManuallyPaused: next },
  });
  return NextResponse.json({ ok: true, followupManuallyPaused: lead.followupManuallyPaused });
}
