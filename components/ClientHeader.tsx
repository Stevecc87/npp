'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function ClientHeader() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setEmail(data.session?.user.email ?? null);
    };
    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return (
    <div className="top-bar">
      <div className="brand">
        <h1>NeoOhio Underwriter</h1>
        <span>Internal real estate underwriting</span>
      </div>
      <div className="nav-links">
        <Link href="/leads">Leads</Link>
        <Link href="/intake">Call Intake</Link>
        {email ? (
          <button className="button ghost" type="button" onClick={signOut}>
            Sign out ({email})
          </button>
        ) : (
          <Link href="/login">Login</Link>
        )}
      </div>
    </div>
  );
}
