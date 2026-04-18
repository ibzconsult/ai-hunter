import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { connectInstance, getStatus } from '@/lib/uazapi';

type Params = Promise<{ id: string }>;

export async function DELETE(_req: NextRequest, ctx: { params: Params }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ success: false }, { status: 401 });
  const { id } = await ctx.params;

  const result = await prisma.instance.deleteMany({
    where: { id, tenantId: s.tenantId },
  });
  if (result.count === 0) {
    return NextResponse.json({ success: false, error: 'Instância não encontrada' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

export async function POST(req: NextRequest, ctx: { params: Params }) {
  // POST /api/instances/:id?action=connect|status
  const s = await getSession();
  if (!s) return NextResponse.json({ success: false }, { status: 401 });
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? 'status';

  const inst = await prisma.instance.findFirst({ where: { id, tenantId: s.tenantId } });
  if (!inst || !inst.instanceToken) {
    return NextResponse.json({ success: false, error: 'Instância não encontrada' }, { status: 404 });
  }

  try {
    let connectQr: string | null = null;
    if (action === 'connect') {
      const c = await connectInstance(inst.instanceToken);
      connectQr = c.qrcode;
      await new Promise((r) => setTimeout(r, 3000));
    }
    const statusResp = await getStatus(inst.instanceToken);
    const status = statusResp.status;
    const qrcode = statusResp.qrcode ?? connectQr;

    const updated = await prisma.instance.update({
      where: { id: inst.id },
      data: {
        status,
        lastQrAt: qrcode ? new Date() : inst.lastQrAt,
        disconnectedAt: status === 'disconnected' ? new Date() : null,
      },
    });
    return NextResponse.json({ success: true, instance: { ...updated, qrcode } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
