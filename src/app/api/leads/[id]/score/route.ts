import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { recomputeScore } from '@/lib/scoring';

type Params = Promise<{ id: string }>;

export async function POST(_req: NextRequest, ctx: { params: Params }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const lead = await prisma.lead.findFirst({ where: { id, tenantId: s.tenantId } });
  if (!lead) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  const result = await recomputeScore(id, { force: true });
  const updated = await prisma.lead.findUnique({ where: { id } });
  return NextResponse.json({ ok: true, result, lead: updated });
}
