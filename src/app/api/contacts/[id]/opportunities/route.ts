import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

type Params = Promise<{ id: string }>;

export async function GET(_req: NextRequest, ctx: { params: Params }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const contact = await prisma.contact.findFirst({ where: { id, tenantId: s.tenantId } });
  if (!contact) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  const opportunities = await prisma.lead.findMany({
    where: { contactId: id, tenantId: s.tenantId },
    orderBy: { createdAt: 'desc' },
    include: { stage: true, company: true },
  });
  return NextResponse.json({ ok: true, opportunities });
}
