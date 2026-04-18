import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function PUT(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ success: false }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const data = {
    produtosServicos: body.produtos_servicos?.toString() ?? undefined,
    icp: body.icp?.toString() ?? undefined,
    diferenciais: body.diferenciais?.toString() ?? undefined,
    tomAbordagem: body.tom_abordagem?.toString() ?? undefined,
    propostaValor: body.proposta_valor?.toString() ?? undefined,
    mensagemPadrao: body.mensagem_padrao?.toString() ?? undefined,
    openaiApiKey: body.openai_api_key?.toString().trim() ?? undefined,
    serpapiKey: body.serpapi_key?.toString().trim() ?? undefined,
    nomeEmpresa: body.nome_empresa?.toString() ?? undefined,
    apresentacao: body.apresentacao?.toString() ?? undefined,
    cumprimento1: body.cumprimento_1?.toString() ?? undefined,
    cumprimento2: body.cumprimento_2?.toString() ?? undefined,
    cumprimento3: body.cumprimento_3?.toString() ?? undefined,
  };

  const tenant = await prisma.tenant.update({
    where: { id: s.tenantId },
    data,
    select: { id: true, nomeEmpresa: true, email: true },
  });

  return NextResponse.json({ success: true, tenant });
}
