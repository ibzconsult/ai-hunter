import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

type Params = Promise<{ id: string }>;

export async function PATCH(req: NextRequest, ctx: { params: Params }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ success: false }, { status: 401 });
  const { id } = await ctx.params;
  const existing = await prisma.knowledgeDoc.findFirst({ where: { id, tenantId: s.tenantId } });
  if (!existing) return NextResponse.json({ success: false }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (body.titulo !== undefined) data.titulo = String(body.titulo).trim().slice(0, 200);
  if (body.descricao !== undefined)
    data.descricao = String(body.descricao).trim().slice(0, 500) || null;
  if (body.conteudoTexto !== undefined)
    data.conteudoTexto = String(body.conteudoTexto).trim() || null;
  if (body.fileUrl !== undefined) data.fileUrl = String(body.fileUrl).trim() || null;
  if (body.fileType !== undefined)
    data.fileType = String(body.fileType).trim().slice(0, 20) || null;
  if (typeof body.sendable === 'boolean') data.sendable = body.sendable;

  const doc = await prisma.knowledgeDoc.update({ where: { id }, data });
  return NextResponse.json({ success: true, doc });
}

export async function DELETE(_req: NextRequest, ctx: { params: Params }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ success: false }, { status: 401 });
  const { id } = await ctx.params;
  const existing = await prisma.knowledgeDoc.findFirst({ where: { id, tenantId: s.tenantId } });
  if (!existing) return NextResponse.json({ success: false }, { status: 404 });
  await prisma.knowledgeDoc.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
