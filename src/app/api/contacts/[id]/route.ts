import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { normalizePhone } from '@/lib/phone';

type Params = Promise<{ id: string }>;

export async function GET(_req: NextRequest, ctx: { params: Params }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const contact = await prisma.contact.findFirst({
    where: { id, tenantId: s.tenantId },
    include: {
      company: true,
      leads: { orderBy: { createdAt: 'desc' }, include: { stage: true, company: true } },
    },
  });
  if (!contact) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true, contact });
}

export async function PATCH(req: NextRequest, ctx: { params: Params }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const existing = await prisma.contact.findFirst({ where: { id, tenantId: s.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.firstName !== undefined) data.firstName = String(body.firstName).trim() || null;
  if (body.lastName !== undefined) data.lastName = String(body.lastName).trim() || null;
  if (body.email !== undefined) data.email = String(body.email).trim() || null;
  if (body.role !== undefined) data.role = String(body.role).trim() || null;
  if (body.companyId !== undefined)
    data.companyId = body.companyId ? String(body.companyId) : null;
  if (body.phone !== undefined) {
    const raw = String(body.phone).trim();
    data.phone = raw ? normalizePhone(raw) : null;
  }
  const settingPrimary = body.isPrimary === true;
  if (body.isPrimary !== undefined) data.isPrimary = !!body.isPrimary;

  try {
    const nextCompanyId =
      (data.companyId as string | null | undefined) !== undefined
        ? (data.companyId as string | null)
        : existing.companyId;

    if (settingPrimary && nextCompanyId) {
      const contact = await prisma.$transaction(async (tx) => {
        await tx.contact.updateMany({
          where: {
            tenantId: s.tenantId,
            companyId: nextCompanyId,
            isPrimary: true,
            NOT: { id },
          },
          data: { isPrimary: false },
        });
        return tx.contact.update({ where: { id }, data });
      });
      return NextResponse.json({ ok: true, contact });
    }

    const contact = await prisma.contact.update({ where: { id }, data });
    return NextResponse.json({ ok: true, contact });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'erro' },
      { status: 400 }
    );
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Params }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const existing = await prisma.contact.findFirst({ where: { id, tenantId: s.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  await prisma.contact.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
