import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

type Params = Promise<{ id: string }>;

export async function POST(req: NextRequest, ctx: { params: Params }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ success: false }, { status: 401 });
  const { id } = await ctx.params;

  const pipe = await prisma.pipeline.findFirst({
    where: { id, tenantId: s.tenantId },
    include: { stages: { orderBy: { ordem: 'desc' }, take: 1 } },
  });
  if (!pipe) return NextResponse.json({ success: false, error: 'Pipeline não encontrado' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const nome = String(body.nome ?? 'Nova etapa').trim().slice(0, 100) || 'Nova etapa';
  const nextOrdem = (pipe.stages[0]?.ordem ?? 0) + 1;

  const stage = await prisma.stage.create({
    data: { pipelineId: id, nome, ordem: nextOrdem, tipo: 'custom' },
  });
  return NextResponse.json({ success: true, stage });
}
