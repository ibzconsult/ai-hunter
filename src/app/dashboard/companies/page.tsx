import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import CompaniesClient from './CompaniesClient';

export default async function CompaniesPage() {
  const s = await getSession();
  if (!s) redirect('/login');
  return <CompaniesClient />;
}
