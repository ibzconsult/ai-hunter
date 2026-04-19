import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  const tags = await prisma.tag.findMany({
    where: { tenantId: s.tenantId },
    orderBy: { nome: 'asc' },
  });
  return NextResponse.json({ ok: true, tags });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const nome = String(body.nome ?? '').trim().slice(0, 60);
  if (!nome) return NextResponse.json({ ok: false, error: 'nome_vazio' }, { status: 400 });
  const color = String(body.color ?? '#64748b').slice(0, 9);

  const dup = await prisma.tag.findFirst({ where: { tenantId: s.tenantId, nome } });
  if (dup) return NextResponse.json({ ok: false, error: 'tag_duplicada' }, { status: 400 });

  const tag = await prisma.tag.create({ data: { tenantId: s.tenantId, nome, color } });
  return NextResponse.json({ ok: true, tag });
}
