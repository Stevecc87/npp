'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import RequireAuth from '@/components/RequireAuth';
import { Lead, Valuation } from '@/lib/types';

type LeadSummary = {
  lead: Lead;
  valuation: Valuation | null;
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    try {
      const response = await fetch('/api/leads/list', { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to load leads');
      const data = await response.json();
      setLeads(data.leads);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const deleteLead = async (leadId: string, label: string) => {
    const ok = window.confirm(`Delete lead for ${label}? This cannot be undone.`);
    if (!ok) return;

    setDeletingId(leadId);
    setError(null);
    try {
      const response = await fetch(`/api/leads/${leadId}`, { method: 'DELETE' });
      const body = await response.text();
      if (!response.ok) throw new Error(body || 'Failed to delete lead');
      setLeads((prev) => prev.filter((item) => item.lead.id !== leadId));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      setError(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <RequireAuth>
      <div className="grid">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 className="section-title">Leads Dashboard</h2>
              <p className="muted">Track active calls and underwriting outputs.</p>
            </div>
            <Link className="button" href="/intake">
              New Intake
            </Link>
          </div>
          {loading ? <p className="muted">Loading leads...</p> : null}
          {error ? <p className="error">{error}</p> : null}
          {!loading && leads.length === 0 ? (
            <p className="muted">No leads yet. Start with a call intake.</p>
          ) : null}
          <div className="lead-list">
            {leads.map(({ lead, valuation }) => {
              const label = `${lead.street}, ${lead.city}`;
              return (
                <div key={lead.id} className="lead-item" style={{ gap: 12 }}>
                  <Link href={`/leads/${lead.id}`} style={{ flex: 1 }}>
                    <div>
                      <strong>
                        {lead.street}, {lead.city}, {lead.state} {lead.zip}
                      </strong>
                      <div className="muted">Seller: {lead.seller_name || 'Unknown'}</div>
                    </div>
                  </Link>
                  <div style={{ textAlign: 'right' }}>
                    {valuation ? (
                      <>
                        <div className="muted">
                          ${valuation.cash_offer_low.toLocaleString()} - ${valuation.cash_offer_high.toLocaleString()}
                        </div>
                      </>
                    ) : (
                      <div className="muted">No valuation yet</div>
                    )}
                  </div>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => deleteLead(lead.id, label)}
                    disabled={deletingId === lead.id}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {deletingId === lead.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </RequireAuth>
  );
}
