import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { firstStageId } from '@/lib/pipeline';
import { normalizePhone } from '@/lib/phone';
import { upsertCompanyByName, upsertContactByPhone } from '@/lib/crm';

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ success: false }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  const phoneRaw = body.telefone ? String(body.telefone).trim() : '';
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  const empresa = body.empresa ? String(body.empresa).trim() || null : null;
  let contactId = body.contactId ? String(body.contactId) : null;
  let companyId = body.companyId ? String(body.companyId) : null;

  // Oportunidade precisa de ao menos um dos dois (contato OU empresa)
  const hasContactInfo = phone || body.firstName || contactId;
  const hasCompanyInfo = empresa || companyId;
  if (!hasContactInfo && !hasCompanyInfo) {
    return NextResponse.json(
      { success: false, error: 'Informe ao menos contato ou empresa' },
      { status: 400 }
    );
  }

  // Se phone, valida duplicidade (unique em Lead)
  if (phone) {
    const dup = await prisma.lead.findFirst({
      where: { tenantId: s.tenantId, telefone: phone },
      select: { id: true },
    });
    if (dup)
      return NextResponse.json(
        { success: false, error: 'Lead com esse WhatsApp já existe' },
        { status: 400 }
      );
  }

  // Upsert Company se vier empresa string inline
  if (!companyId && empresa) {
    const c = await upsertCompanyByName(s.tenantId, empresa, {
      site: body.site ? String(body.site).trim() || null : null,
    });
    companyId = c.id;
  }

  // Upsert Contact se vier phone
  if (!contactId && phone) {
    const c = await upsertContactByPhone(s.tenantId, phone, {
      firstName: body.firstName ? String(body.firstName).trim() || null : null,
      companyId,
    });
    contactId = c.id;
  }

  const firstName = body.firstName ? String(body.firstName).trim() || null : null;
  const stageId = await firstStageId(s.tenantId);
  const lead = await prisma.lead.create({
    data: {
      tenantId: s.tenantId,
      telefone: phone,
      firstName,
      empresa,
      site: body.site ? String(body.site).trim() || null : null,
      contexto: body.contexto ? String(body.contexto).trim() || null : null,
      contactId,
      companyId,
      origem: ['manual', 'inbound', 'outbound', 'indication'].includes(String(body.origem))
        ? String(body.origem)
        : 'manual',
      stageId,
    },
    include: { contact: true, company: true },
  });
  return NextResponse.json({ success: true, lead });
}

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ success: false }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const origem = url.searchParams.get('origem');

  const rows = await prisma.lead.findMany({
    where: {
      tenantId: s.tenantId,
      ...(status ? { disparo: status } : {}),
      ...(origem ? { origem } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: {
      tags: { include: { tag: true } },
      contact: true,
      company: true,
    },
  });
  const leads = rows.map((l) => ({
    ...l,
    tags: l.tags.map((lt) => ({ id: lt.tag.id, nome: lt.tag.nome, color: lt.tag.color })),
  }));
  return NextResponse.json({ success: true, leads });
}

export async function DELETE(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ success: false }, { status: 401 });
  const { ids } = await req.json().catch(() => ({ ids: [] }));
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ success: false, error: 'Nenhum id' }, { status: 400 });
  }
  const r = await prisma.lead.deleteMany({
    where: { id: { in: ids }, tenantId: s.tenantId },
  });
  return NextResponse.json({ success: true, deleted: r.count });
}
