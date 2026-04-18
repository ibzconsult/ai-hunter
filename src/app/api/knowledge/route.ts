import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ success: false }, { status: 401 });
  const docs = await prisma.knowledgeDoc.findMany({
    where: { tenantId: s.tenantId },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json({ success: true, docs });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ success: false }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const titulo = String(body.titulo ?? '').trim();
  if (!titulo) return NextResponse.json({ success: false, error: 'Título obrigatório' }, { status: 400 });

  const doc = await prisma.knowledgeDoc.create({
    data: {
      tenantId: s.tenantId,
      titulo: titulo.slice(0, 200),
      descricao: body.descricao ? String(body.descricao).trim().slice(0, 500) || null : null,
      conteudoTexto: body.conteudoTexto ? String(body.conteudoTexto).trim() || null : null,
      fileUrl: body.fileUrl ? String(body.fileUrl).trim() || null : null,
      fileType: body.fileType ? String(body.fileType).trim().slice(0, 20) || null : null,
      sendable: body.sendable !== false,
    },
  });
  return NextResponse.json({ success: true, doc });
}
