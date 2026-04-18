import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

type Params = Promise<{ id: string }>;

export async function GET(_req: NextRequest, ctx: { params: Params }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ success: false }, { status: 401 });
  const { id } = await ctx.params;
  const lead = await prisma.lead.findFirst({ where: { id, tenantId: s.tenantId }, select: { id: true } });
  if (!lead) return NextResponse.json({ success: false }, { status: 404 });
  const messages = await prisma.message.findMany({
    where: { leadId: id, tenantId: s.tenantId },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
  return NextResponse.json({ success: true, messages });
}
