import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

type Params = Promise<{ id: string }>;

export async function PATCH(req: NextRequest, ctx: { params: Params }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const existing = await prisma.tag.findFirst({ where: { id, tenantId: s.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

  const data: { nome?: string; color?: string } = {};
  if (body.nome !== undefined) data.nome = String(body.nome).trim().slice(0, 60);
  if (body.color !== undefined) data.color = String(body.color).slice(0, 9);

  const tag = await prisma.tag.update({ where: { id }, data });
  return NextResponse.json({ ok: true, tag });
}

export async function DELETE(_req: NextRequest, ctx: { params: Params }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const existing = await prisma.tag.findFirst({ where: { id, tenantId: s.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  await prisma.tag.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
