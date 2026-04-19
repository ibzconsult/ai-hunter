import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import FollowupConfigClient from './FollowupConfigClient';

export default async function FollowupsPage() {
  const s = await getSession();
  if (!s) redirect('/login');
  return <FollowupConfigClient />;
}
