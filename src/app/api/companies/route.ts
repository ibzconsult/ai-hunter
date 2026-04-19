import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { upsertCompanyByName } from '@/lib/crm';

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();

  const rows = await prisma.company.findMany({
    where: {
      tenantId: s.tenantId,
      ...(q ? { nome: { contains: q, mode: 'insensitive' } } : {}),
    },
    orderBy: { nome: 'asc' },
    take: 500,
    include: {
      _count: { select: { contacts: true, leads: true } },
      contacts: {
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        take: 1,
        select: { id: true, firstName: true, lastName: true, isPrimary: true },
      },
    },
  });
  const companies = rows.map((c) => ({
    ...c,
    primaryContact: c.contacts[0] ?? null,
  }));
  return NextResponse.json({ ok: true, companies });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const nome = String(body.nome ?? '').trim();
  if (!nome) return NextResponse.json({ ok: false, error: 'nome_obrigatorio' }, { status: 400 });

  try {
    const company = await upsertCompanyByName(s.tenantId, nome, {
      site: body.site ? String(body.site).trim() : null,
      segmento: body.segmento ? String(body.segmento).trim() : null,
      notes: body.notes ? String(body.notes) : null,
    });
    return NextResponse.json({ ok: true, company });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'erro' },
      { status: 400 }
    );
  }
}
