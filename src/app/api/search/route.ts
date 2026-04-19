import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { searchProspects } from '@/lib/serpapi';
import { checkWhatsApp, UazapiDisconnectedError } from '@/lib/uazapi';

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ success: false }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const query = String(body.query ?? '').trim();
  const location = body.location ? String(body.location).trim() : undefined;
  const instanceId = body.instance_id ? String(body.instance_id) : undefined;
  const maxPages = body.maxPages ? Number(body.maxPages) : undefined;
  if (!query) {
    return NextResponse.json({ success: false, error: 'Informe a busca' }, { status: 400 });
  }
  if (!instanceId) {
    return NextResponse.json(
      { success: false, error: 'Selecione uma instância WhatsApp conectada' },
      { status: 400 }
    );
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: s.tenantId },
    select: { serpapiKey: true },
  });
  if (!tenant?.serpapiKey) {
    return NextResponse.json(
      { success: false, error: 'SerpAPI key não configurada no perfil' },
      { status: 400 }
    );
  }

  const instance = await prisma.instance.findFirst({
    where: { id: instanceId, tenantId: s.tenantId },
    select: { instanceToken: true },
  });
  if (!instance?.instanceToken) {
    return NextResponse.json({ success: false, error: 'Instância inválida' }, { status: 400 });
  }

  try {
    const prospects = await searchProspects(tenant.serpapiKey, query, location, {
      maxPages: maxPages,
    });
    if (prospects.length === 0) {
      return NextResponse.json({ success: true, prospects: [], totalFound: 0, withWhatsapp: 0 });
    }

    const phones = prospects.map((p) => p.telefone);
    let waMap: Record<string, boolean>;
    try {
      waMap = await checkWhatsApp(instance.instanceToken, phones);
    } catch (e) {
      if (e instanceof UazapiDisconnectedError) {
        await prisma.instance.update({
          where: { id: instanceId },
          data: { status: 'disconnected', disconnectedAt: new Date() },
        });
        return NextResponse.json(
          {
            success: false,
            error: 'Sua instância de WhatsApp está desconectada. Abra "WhatsApp" no menu e reconecte escaneando o QR Code.',
            reason: 'whatsapp_disconnected',
          },
          { status: 409 }
        );
      }
      throw e;
    }
    const onlyWa = prospects.filter((p) => waMap[p.telefone]);

    const existing = await prisma.lead.findMany({
      where: { tenantId: s.tenantId, telefone: { in: onlyWa.map((p) => p.telefone) } },
      select: { telefone: true, disparo: true },
    });
    const existingMap = new Map(existing.map((e) => [e.telefone, e.disparo]));

    const enriched = onlyWa.map((p) => ({
      ...p,
      jaEnviado: existingMap.get(p.telefone) === 'sim',
      existe: existingMap.has(p.telefone),
    }));

    return NextResponse.json({
      success: true,
      prospects: enriched,
      totalFound: prospects.length,
      withWhatsapp: enriched.length,
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Erro na busca';
    return NextResponse.json({ success: false, error: err }, { status: 500 });
  }
}
