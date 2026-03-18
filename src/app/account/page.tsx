// src/app/account/page.tsx — redirect to /account/profile
import { redirect } from 'next/navigation';
export default function AccountPage() {
  redirect('/account/profile');
}
