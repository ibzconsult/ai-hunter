import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { signSession, setSessionCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const nomeEmpresa = String(body.nome_empresa ?? '').trim();
  const email = String(body.email ?? '').toLowerCase().trim();
  const password = String(body.password ?? '');
  const telefone = String(body.telefone ?? '').trim();

  if (!nomeEmpresa || !email || !password) {
    return NextResponse.json({ success: false, error: 'Preencha todos os campos obrigatórios' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ success: false, error: 'Senha deve ter no mínimo 6 caracteres' }, { status: 400 });
  }

  const exists = await prisma.tenant.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ success: false, error: 'Este email já está cadastrado' }, { status: 409 });
  }

  const senhaHash = await bcrypt.hash(password, 10);
  const tenant = await prisma.tenant.create({
    data: { nomeEmpresa, email, senhaHash, telefone: telefone || null },
    select: { id: true, nomeEmpresa: true, email: true },
  });

  const token = await signSession({ tenantId: tenant.id, email: tenant.email });
  await setSessionCookie(token);

  return NextResponse.json({ success: true, tenant });
}
