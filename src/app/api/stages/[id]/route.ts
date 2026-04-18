import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

type Params = Promise<{ id: string }>;

async function verifyStage(tenantId: string, stageId: string) {
  return prisma.stage.findFirst({
    where: { id: stageId, pipeline: { tenantId } },
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Params }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ success: false }, { status: 401 });
  const { id } = await ctx.params;
  const stage = await verifyStage(s.tenantId, id);
  if (!stage) return NextResponse.json({ success: false, error: 'Etapa não encontrada' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (body.nome !== undefined) data.nome = String(body.nome).trim().slice(0, 100) || stage.nome;
  if (body.ordem !== undefined) data.ordem = Number(body.ordem);

  const updated = await prisma.stage.update({ where: { id }, data });
  return NextResponse.json({ success: true, stage: updated });
}

export async function DELETE(_req: NextRequest, ctx: { params: Params }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ success: false }, { status: 401 });
  const { id } = await ctx.params;
  const stage = await verifyStage(s.tenantId, id);
  if (!stage) return NextResponse.json({ success: false, error: 'Etapa não encontrada' }, { status: 404 });

  if (stage.tipo !== 'custom') {
    return NextResponse.json(
      { success: false, error: 'Etapas do sistema (novo/contactado/respondeu/ganho/perdido) não podem ser removidas' },
      { status: 400 }
    );
  }

  // leads ficam com stageId=null via cascade SetNull do schema
  await prisma.stage.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
