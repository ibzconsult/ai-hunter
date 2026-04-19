import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

type Params = Promise<{ id: string }>;

export async function GET(_req: NextRequest, ctx: { params: Params }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const company = await prisma.company.findFirst({
    where: { id, tenantId: s.tenantId },
    include: {
      contacts: { orderBy: { firstName: 'asc' } },
      leads: {
        orderBy: { createdAt: 'desc' },
        include: { stage: true },
      },
    },
  });
  if (!company) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true, company });
}

export async function PATCH(req: NextRequest, ctx: { params: Params }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const existing = await prisma.company.findFirst({ where: { id, tenantId: s.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.nome !== undefined) data.nome = String(body.nome).trim().slice(0, 255) || existing.nome;
  if (body.site !== undefined) data.site = String(body.site).trim() || null;
  if (body.segmento !== undefined) data.segmento = String(body.segmento).trim() || null;
  if (body.notes !== undefined) data.notes = String(body.notes) || null;

  try {
    const company = await prisma.company.update({ where: { id }, data });
    return NextResponse.json({ ok: true, company });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'erro' },
      { status: 400 }
    );
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Params }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const existing = await prisma.company.findFirst({ where: { id, tenantId: s.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  await prisma.company.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
