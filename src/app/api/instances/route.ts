import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { initInstance, connectInstance, getStatus } from '@/lib/uazapi';

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ success: false }, { status: 401 });

  const instances = await prisma.instance.findMany({
    where: { tenantId: s.tenantId },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ success: true, instances });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ success: false }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const label = String(body.label ?? 'WhatsApp');
  const instanceName = `prospector_${s.tenantId.slice(0, 8)}_${Date.now()}`;

  try {
    const { token } = await initInstance(instanceName);
    const connectResp = await connectInstance(token);
    await new Promise((r) => setTimeout(r, 3000));
    const statusResp = await getStatus(token);
    const status = statusResp.status;
    const qrcode = statusResp.qrcode ?? connectResp.qrcode;

    const inst = await prisma.instance.create({
      data: {
        tenantId: s.tenantId,
        label,
        uazapiUrl: process.env.UAZAPI_URL ?? 'https://ibusiness.uazapi.com',
        instanceToken: token,
        instanceName,
        uazapiSessionId: instanceName,
        status,
        lastQrAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, instance: { ...inst, qrcode } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
