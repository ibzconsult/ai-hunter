import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

type Params = Promise<{ id: string }>;

export async function GET(_req: NextRequest, ctx: { params: Params }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const company = await prisma.company.findFirst({ where: { id, tenantId: s.tenantId } });
  if (!company) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  const contacts = await prisma.contact.findMany({
    where: { companyId: id, tenantId: s.tenantId },
    orderBy: { firstName: 'asc' },
  });
  return NextResponse.json({ ok: true, contacts });
}
