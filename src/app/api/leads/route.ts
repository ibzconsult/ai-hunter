import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { firstStageId } from '@/lib/pipeline';
import { normalizePhone } from '@/lib/phone';

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ success: false }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  const phone = normalizePhone(String(body.telefone ?? ''));
  if (!phone) return NextResponse.json({ success: false, error: 'WhatsApp inválido' }, { status: 400 });

  const dup = await prisma.lead.findFirst({
    where: { tenantId: s.tenantId, telefone: phone },
    select: { id: true },
  });
  if (dup) return NextResponse.json({ success: false, error: 'Lead com esse WhatsApp já existe' }, { status: 400 });

  const firstName = body.firstName ? String(body.firstName).trim() || null : null;
  const stageId = await firstStageId(s.tenantId);
  const lead = await prisma.lead.create({
    data: {
      tenantId: s.tenantId,
      telefone: phone,
      firstName,
      empresa: body.empresa ? String(body.empresa).trim() || null : null,
      site: body.site ? String(body.site).trim() || null : null,
      contexto: body.contexto ? String(body.contexto).trim() || null : null,
      origem: 'manual',
      stageId,
    },
  });
  return NextResponse.json({ success: true, lead });
}

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ success: false }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const origem = url.searchParams.get('origem');

  const leads = await prisma.lead.findMany({
    where: {
      tenantId: s.tenantId,
      ...(status ? { disparo: status } : {}),
      ...(origem ? { origem } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
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
