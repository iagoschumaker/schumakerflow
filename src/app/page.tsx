import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';

export default async function HomePage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  // Redirect based on role
  switch (session.role) {
    case 'SUPERADMIN':
      redirect('/superadmin');
    case 'CLIENT_USER':
      redirect('/portal');
    default:
      redirect('/admin');
  }
}
