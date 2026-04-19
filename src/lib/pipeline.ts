import { prisma } from '@/lib/db';

const DEFAULT_STAGES = [
  { nome: 'Triagem', ordem: 0, tipo: 'triage' },
  { nome: 'Novo lead', ordem: 1, tipo: 'new' },
  { nome: 'Contactado', ordem: 2, tipo: 'contacted' },
  { nome: 'Respondeu', ordem: 3, tipo: 'replied' },
  { nome: 'Em negociação', ordem: 4, tipo: 'custom' },
  { nome: 'Ganho', ordem: 5, tipo: 'won' },
  { nome: 'Perdido', ordem: 6, tipo: 'lost' },
];

export async function ensureDefaultPipeline(tenantId: string) {
  const existing = await prisma.pipeline.findFirst({
    where: { tenantId, isDefault: true },
    include: { stages: { orderBy: { ordem: 'asc' } } },
  });
  if (existing) return existing;

  return prisma.pipeline.create({
    data: {
      tenantId,
      nome: 'Funil principal',
      isDefault: true,
      stages: { create: DEFAULT_STAGES },
    },
    include: { stages: { orderBy: { ordem: 'asc' } } },
  });
}

export async function firstStageId(tenantId: string): Promise<string | null> {
  const pipe = await ensureDefaultPipeline(tenantId);
  return pipe.stages[0]?.id ?? null;
}

export async function stageIdByType(
  tenantId: string,
  tipo: 'triage' | 'new' | 'contacted' | 'replied' | 'won' | 'lost'
): Promise<string | null> {
  const pipe = await ensureDefaultPipeline(tenantId);
  return pipe.stages.find((s) => s.tipo === tipo)?.id ?? null;
}
