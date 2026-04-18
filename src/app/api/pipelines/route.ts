import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { ensureDefaultPipeline } from '@/lib/pipeline';

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ success: false }, { status: 401 });

  const defaultPipe = await ensureDefaultPipeline(s.tenantId);

  // Backfill leads órfãos (sem etapa) pra primeira etapa
  const firstStage = defaultPipe.stages[0];
  if (firstStage) {
    await prisma.lead.updateMany({
      where: { tenantId: s.tenantId, stageId: null },
      data: { stageId: firstStage.id },
    });
  }

  const pipelines = await prisma.pipeline.findMany({
    where: { tenantId: s.tenantId },
    include: { stages: { orderBy: { ordem: 'asc' } } },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
  return NextResponse.json({ success: true, pipelines });
}
