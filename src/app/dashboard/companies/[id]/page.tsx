import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import CompanyDetailClient from './CompanyDetailClient';

type Params = Promise<{ id: string }>;

export default async function CompanyDetailPage({ params }: { params: Params }) {
  const s = await getSession();
  if (!s) redirect('/login');
  const { id } = await params;
  return <CompanyDetailClient id={id} />;
}
