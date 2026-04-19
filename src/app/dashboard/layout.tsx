import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import SharedSidebar from './_components/SharedSidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s) redirect('/login');

  const tenant = await prisma.tenant.findUnique({
    where: { id: s.tenantId },
    select: { nomeEmpresa: true, email: true },
  });
  if (!tenant) redirect('/login');

  return (
    <div className="min-h-screen flex">
      <SharedSidebar tenant={tenant} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
