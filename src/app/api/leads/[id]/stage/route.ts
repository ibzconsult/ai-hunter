import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

type Params = Promise<{ id: string }>;

export async function PATCH(req: NextRequest, ctx: { params: Params }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ success: false }, { status: 401 });
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const stageId = body.stageId ? String(body.stageId) : null;

  const lead = await prisma.lead.findFirst({ where: { id, tenantId: s.tenantId } });
  if (!lead) return NextResponse.json({ success: false, error: 'Lead não encontrado' }, { status: 404 });

  if (stageId) {
    const stage = await prisma.stage.findFirst({
      where: { id: stageId, pipeline: { tenantId: s.tenantId } },
    });
    if (!stage) return NextResponse.json({ success: false, error: 'Etapa inválida' }, { status: 400 });
  }

  const updated = await prisma.lead.update({ where: { id }, data: { stageId } });
  return NextResponse.json({ success: true, lead: updated });
}
