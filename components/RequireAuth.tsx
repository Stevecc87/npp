'use client';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  // Team share mode: authentication is intentionally bypassed.
  return <>{children}</>;
}
