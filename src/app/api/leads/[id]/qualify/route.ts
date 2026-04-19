import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { stageIdByType } from '@/lib/pipeline';
import { scheduleFirstFollowup } from '@/lib/followup';

type Params = Promise<{ id: string }>;

export async function POST(req: NextRequest, ctx: { params: Params }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? 'qualify');

  const lead = await prisma.lead.findFirst({ where: { id, tenantId: s.tenantId } });
  if (!lead) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

  if (action === 'discard') {
    const lostId = await stageIdByType(s.tenantId, 'lost');
    await prisma.lead.update({
      where: { id },
      data: { isDraft: false, stageId: lostId, nextFollowupAt: null },
    });
    return NextResponse.json({ ok: true, status: 'discarded' });
  }

  const newId = await stageIdByType(s.tenantId, 'new');
  await prisma.lead.update({
    where: { id },
    data: { isDraft: false, stageId: newId ?? lead.stageId },
  });
  await scheduleFirstFollowup(id);

  const updated = await prisma.lead.findUnique({ where: { id } });
  return NextResponse.json({ ok: true, status: 'qualified', lead: updated });
}
