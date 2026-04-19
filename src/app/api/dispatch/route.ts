import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { sendText } from '@/lib/uazapi';
import { generateMessages } from '@/lib/openai';
import { scrapeSiteDeep, flattenScrape } from '@/lib/scraper';
import { analyzeSite, type SiteAnalysis } from '@/lib/siteAnalysis';
import { firstStageId, stageIdByType } from '@/lib/pipeline';
import { scheduleFirstFollowup } from '@/lib/followup';

type ProspectInput = {
  nome_empresa: string;
  first_name?: string;
  telefone: string;
  rating_google?: number;
  reviews_google?: number;
  especialidades?: string;
  site_empresa?: string;
  has_whatsapp?: string;
  contexto?: string;
};

type DispatchBody = {
  instance_id: string;
  lead_id?: string;
  prospect?: ProspectInput;
};

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ success: false }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Partial<DispatchBody>;
  const instanceId = body.instance_id;
  if (!instanceId) {
    return NextResponse.json({ success: false, error: 'instance_id obrigatório' }, { status: 400 });
  }

  const [tenant, instance] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: s.tenantId } }),
    prisma.instance.findFirst({ where: { id: instanceId, tenantId: s.tenantId } }),
  ]);
  if (!tenant) return NextResponse.json({ success: false, error: 'Tenant não encontrado' }, { status: 401 });
  if (!instance?.instanceToken) {
    return NextResponse.json({ success: false, error: 'Instância inválida' }, { status: 400 });
  }
  if (!tenant.openaiApiKey) {
    return NextResponse.json({ success: false, error: 'OpenAI key não configurada' }, { status: 400 });
  }

  let lead;
  if (body.lead_id) {
    lead = await prisma.lead.findFirst({
      where: { id: body.lead_id, tenantId: s.tenantId },
    });
    if (!lead) return NextResponse.json({ success: false, error: 'Lead não encontrado' }, { status: 404 });
  } else {
    const p = body.prospect;
    if (!p?.nome_empresa || !p.telefone) {
      return NextResponse.json({ success: false, error: 'Payload incompleto' }, { status: 400 });
    }
    const initStage = await firstStageId(s.tenantId);
    lead = await prisma.lead.upsert({
      where: { tenantId_telefone: { tenantId: s.tenantId, telefone: p.telefone } },
      create: {
        tenantId: s.tenantId,
        empresa: p.nome_empresa,
        firstName: p.first_name ?? null,
        telefone: p.telefone,
        rating: p.rating_google ?? null,
        reviews: p.reviews_google ?? null,
        especialidades: p.especialidades ?? null,
        site: p.site_empresa ?? null,
        hasWhatsapp: p.has_whatsapp ?? null,
        contexto: p.contexto ?? null,
        origem: 'prospect',
        stageId: initStage,
      },
      update: {
        empresa: p.nome_empresa,
        firstName: p.first_name ?? undefined,
        especialidades: p.especialidades ?? undefined,
        site: p.site_empresa ?? undefined,
        contexto: p.contexto ?? undefined,
      },
    });
  }

  if (!lead.telefone) {
    return NextResponse.json({ success: false, error: 'Lead sem telefone' }, { status: 400 });
  }

  try {
    let siteScrape = lead.siteScrape ?? '';
    let siteAnalysis = (lead.siteAnalysis as SiteAnalysis | null) ?? null;

    if (lead.site && !siteAnalysis) {
      const scrape = await scrapeSiteDeep(lead.site);
      if (scrape.pages.length) {
        siteScrape = flattenScrape(scrape, 15000);
        siteAnalysis = await analyzeSite(tenant.openaiApiKey, scrape, {
          especialidades: lead.especialidades ?? undefined,
          empresa: lead.empresa ?? undefined,
        });
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            siteScrape,
            ...(siteAnalysis ? { siteAnalysis: siteAnalysis as unknown as object } : {}),
          },
        });
      }
    }

    const cumprimentos = [tenant.cumprimento1, tenant.cumprimento2, tenant.cumprimento3]
      .map((c) => c?.trim())
      .filter((c): c is string => !!c);

    const messages = await generateMessages(
      tenant.openaiApiKey,
      {
        nomeEmpresa: tenant.nomeEmpresa,
        produtosServicos: tenant.produtosServicos ?? '',
        icp: tenant.icp ?? '',
        diferenciais: tenant.diferenciais ?? '',
        tomAbordagem: tenant.tomAbordagem,
        propostaValor: tenant.propostaValor ?? '',
        mensagemPadrao: tenant.mensagemPadrao ?? '',
        apresentacao: tenant.apresentacao ?? '',
        cumprimentos,
      },
      {
        nomeEmpresa: lead.empresa ?? 'Empresa',
        firstName: lead.firstName ?? undefined,
        especialidades: lead.especialidades ?? undefined,
        site: lead.site ?? undefined,
        contexto: lead.contexto ?? undefined,
        siteScrape,
        siteAnalysis,
        segmento: siteAnalysis?.segmento ?? lead.especialidades ?? null,
      }
    );
    if (messages.length === 0) throw new Error('OpenAI retornou vazio');

    for (let i = 0; i < messages.length; i++) {
      await sendText(instance.instanceToken, lead.telefone, messages[i]);
      await prisma.message.create({
        data: {
          tenantId: s.tenantId,
          leadId: lead.id,
          direction: 'out',
          body: messages[i],
          toolCalled: 'dispatch',
        },
      });
      if (i < messages.length - 1) {
        const delayMs = 3000 + Math.random() * 2000; // 3-5s
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    const fullMessage = messages.join('\n\n');
    const contactedStage = await stageIdByType(s.tenantId, 'contacted');
    const newStage = await stageIdByType(s.tenantId, 'new');
    const shouldMoveStage =
      contactedStage &&
      (!lead.stageId || lead.stageId === newStage);

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        disparo: 'sim',
        ultimaMensagem: fullMessage,
        lastInteractionAt: new Date(),
        ...(shouldMoveStage ? { stageId: contactedStage } : {}),
      },
    });

    await scheduleFirstFollowup(lead.id).catch(() => {});

    return NextResponse.json({ success: true, messages, lead_id: lead.id });
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ success: false, error: err, lead_id: lead.id }, { status: 500 });
  }
}
