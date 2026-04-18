import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { signSession, setSessionCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? '').toLowerCase().trim();
  const password = String(body.password ?? '');

  if (!email || !password) {
    return NextResponse.json({ success: false, error: 'Email e senha obrigatórios' }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { email } });
  if (!tenant || !tenant.isActive) {
    return NextResponse.json({ success: false, error: 'Email ou senha incorretos' }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, tenant.senhaHash);
  if (!ok) {
    return NextResponse.json({ success: false, error: 'Email ou senha incorretos' }, { status: 401 });
  }

  const token = await signSession({ tenantId: tenant.id, email: tenant.email });
  await setSessionCookie(token);

  const { senhaHash: _hash, ...safeTenant } = tenant;
  return NextResponse.json({ success: true, tenant: safeTenant });
}
