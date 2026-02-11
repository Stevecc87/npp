'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (!data.session) {
        router.replace('/login');
      } else {
        setChecking(false);
      }
    };
    check();
    return () => {
      isMounted = false;
    };
  }, [router]);

  if (checking) {
    return (
      <div className="card">
        <p className="muted">Checking your session...</p>
      </div>
    );
  }

  return <>{children}</>;
}
