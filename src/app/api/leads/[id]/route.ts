import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { normalizePhone as normalize } from '@/lib/phone';
import { computeNextFollowupAt } from '@/lib/followup';

type Params = Promise<{ id: string }>;

function normalizePhone(raw: string | undefined): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === '') return null;
  return normalize(raw);
}

export async function PATCH(req: NextRequest, ctx: { params: Params }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ success: false }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const existing = await prisma.lead.findFirst({
    where: { id, tenantId: s.tenantId },
  });
  if (!existing) return NextResponse.json({ success: false, error: 'Lead não encontrado' }, { status: 404 });

  const phone = normalizePhone(body.telefone);
  if (phone === null) {
    return NextResponse.json({ success: false, error: 'Telefone inválido' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.empresa !== undefined) data.empresa = String(body.empresa).trim() || null;
  if (body.firstName !== undefined) data.firstName = String(body.firstName).trim() || null;
  if (phone !== undefined) data.telefone = phone;
  if (body.site !== undefined) {
    const site = String(body.site).trim() || null;
    data.site = site;
    if (site !== existing.site) {
      data.siteScrape = null;
      data.siteAnalysis = null;
    }
  }
  if (body.contexto !== undefined) data.contexto = String(body.contexto).trim() || null;
  if (body.especialidades !== undefined)
    data.especialidades = String(body.especialidades).trim() || null;
  if (body.contactId !== undefined) data.contactId = body.contactId ? String(body.contactId) : null;
  if (body.companyId !== undefined) data.companyId = body.companyId ? String(body.companyId) : null;
  if (body.interested !== undefined) {
    const willInterest = !!body.interested;
    data.interested = willInterest;
    if (willInterest) {
      data.nextFollowupAt = null;
      data.interestScore = 100;
      data.interestBand = 'interested';
      data.interestUpdatedAt = new Date();
    } else if (existing.interested) {
      const cfg = await prisma.followupConfig.findUnique({
        where: { tenantId: s.tenantId },
        include: { steps: { orderBy: { order: 'asc' } } },
      });
      if (cfg && cfg.enabled && existing.followupCount < cfg.maxCount) {
        data.nextFollowupAt = computeNextFollowupAt(cfg, existing.followupCount);
      }
    }
  }

  if (phone && phone !== existing.telefone) {
    const dup = await prisma.lead.findFirst({
      where: { tenantId: s.tenantId, telefone: phone, NOT: { id } },
      select: { id: true },
    });
    if (dup) {
      return NextResponse.json(
        { success: false, error: 'Já existe lead com esse WhatsApp' },
        { status: 400 }
      );
    }
  }

  const lead = await prisma.lead.update({ where: { id }, data });
  return NextResponse.json({ success: true, lead });
}
