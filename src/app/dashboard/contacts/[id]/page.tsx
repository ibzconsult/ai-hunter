import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import ContactDetailClient from './ContactDetailClient';

type Params = Promise<{ id: string }>;

export default async function ContactDetailPage({ params }: { params: Params }) {
  const s = await getSession();
  if (!s) redirect('/login');
  const { id } = await params;
  return <ContactDetailClient id={id} />;
}
