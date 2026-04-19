import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

type Params = Promise<{ id: string }>;

async function ensureLeadOwnership(tenantId: string, leadId: string) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, tenantId } });
  return lead;
}

export async function POST(req: NextRequest, ctx: { params: Params }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const tagId = String(body.tagId ?? '');
  if (!tagId) return NextResponse.json({ ok: false, error: 'tagId_ausente' }, { status: 400 });

  const lead = await ensureLeadOwnership(s.tenantId, id);
  if (!lead) return NextResponse.json({ ok: false, error: 'lead_not_found' }, { status: 404 });
  const tag = await prisma.tag.findFirst({ where: { id: tagId, tenantId: s.tenantId } });
  if (!tag) return NextResponse.json({ ok: false, error: 'tag_not_found' }, { status: 404 });

  await prisma.leadTag.upsert({
    where: { leadId_tagId: { leadId: id, tagId } },
    update: {},
    create: { leadId: id, tagId },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: { params: Params }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const tagId = url.searchParams.get('tagId') ?? '';
  if (!tagId) return NextResponse.json({ ok: false, error: 'tagId_ausente' }, { status: 400 });

  const lead = await ensureLeadOwnership(s.tenantId, id);
  if (!lead) return NextResponse.json({ ok: false, error: 'lead_not_found' }, { status: 404 });

  await prisma.leadTag.deleteMany({ where: { leadId: id, tagId } });
  return NextResponse.json({ ok: true });
}
