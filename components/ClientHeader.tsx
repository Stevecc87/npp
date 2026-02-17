'use client';

import Link from 'next/link';

export default function ClientHeader() {
  return (
    <div className="top-bar">
      <div className="brand">
        <h1>NeoOhio Underwriter</h1>
        <span>Internal real estate underwriting</span>
      </div>
      <div className="nav-links">
        <Link href="/leads">Leads</Link>
        <Link href="/intake">Call Intake</Link>
      </div>
    </div>
  );
}
