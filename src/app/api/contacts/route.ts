import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { normalizePhone } from '@/lib/phone';
import { upsertContactByPhone } from '@/lib/crm';

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const companyId = url.searchParams.get('companyId') ?? null;

  const contacts = await prisma.contact.findMany({
    where: {
      tenantId: s.tenantId,
      ...(companyId ? { companyId } : {}),
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { firstName: 'asc' },
    take: 500,
    include: { company: true, _count: { select: { leads: true } } },
  });
  return NextResponse.json({ ok: true, contacts });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  const firstName = body.firstName ? String(body.firstName).trim() : null;
  const lastName = body.lastName ? String(body.lastName).trim() : null;
  const email = body.email ? String(body.email).trim() : null;
  const role = body.role ? String(body.role).trim() : null;
  const companyId = body.companyId ? String(body.companyId) : null;
  const isPrimary = body.isPrimary === true;
  const phoneRaw = body.phone ? String(body.phone).trim() : '';
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;

  if (!firstName && !lastName && !email && !phone) {
    return NextResponse.json({ ok: false, error: 'sem_dados' }, { status: 400 });
  }

  try {
    const run = async () => {
      if (phone) {
        return upsertContactByPhone(s.tenantId, phone, {
          firstName,
          lastName,
          email,
          role,
          companyId,
        });
      }
      return prisma.contact.create({
        data: { tenantId: s.tenantId, firstName, lastName, email, role, companyId },
      });
    };

    if (isPrimary && companyId) {
      const contact = await prisma.$transaction(async (tx) => {
        await tx.contact.updateMany({
          where: { tenantId: s.tenantId, companyId, isPrimary: true },
          data: { isPrimary: false },
        });
        const created = await run();
        return tx.contact.update({ where: { id: created.id }, data: { isPrimary: true } });
      });
      return NextResponse.json({ ok: true, contact });
    }

    const contact = await run();
    return NextResponse.json({ ok: true, contact });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'erro' },
      { status: 400 }
    );
  }
}
