import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ success: false }, { status: 401 });

  const tenant = await prisma.tenant.findUnique({
    where: { id: s.tenantId },
    select: {
      id: true,
      nomeEmpresa: true,
      email: true,
      telefone: true,
      produtosServicos: true,
      icp: true,
      diferenciais: true,
      tomAbordagem: true,
      propostaValor: true,
      mensagemPadrao: true,
      openaiApiKey: true,
      serpapiKey: true,
    },
  });
  if (!tenant) return NextResponse.json({ success: false }, { status: 401 });
  return NextResponse.json({ success: true, tenant });
}
