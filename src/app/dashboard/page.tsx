import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  const s = await getSession();
  if (!s) redirect('/login');

  const [tenant, instances] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: s.tenantId },
      select: {
        id: true,
        nomeEmpresa: true,
        email: true,
        produtosServicos: true,
        icp: true,
        diferenciais: true,
        tomAbordagem: true,
        propostaValor: true,
        mensagemPadrao: true,
        apresentacao: true,
        cumprimento1: true,
        cumprimento2: true,
        cumprimento3: true,
        openaiApiKey: true,
        serpapiKey: true,
      },
    }),
    prisma.instance.findMany({
      where: { tenantId: s.tenantId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  if (!tenant) redirect('/login');

  return <DashboardClient tenant={tenant} initialInstances={instances} />;
}
