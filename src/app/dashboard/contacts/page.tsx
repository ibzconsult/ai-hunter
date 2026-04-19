import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import ContactsClient from './ContactsClient';

export default async function ContactsPage() {
  const s = await getSession();
  if (!s) redirect('/login');
  return <ContactsClient />;
}
