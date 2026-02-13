'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import RequireAuth from '@/components/RequireAuth';
import { IntakeAnswers, Lead, RehabPriceModelTier, Valuation } from '@/lib/types';
import { computeSqftModelOffer } from '@/lib/valuation';

type LeadDetail = {
  lead: Lead;
  intake: IntakeAnswers;
  valuation: Valuation | null;
};

export default function LeadDetailPage() {
  const params = useParams();
  const leadId = useMemo(() => params.id as string, [params.id]);
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [savingEdits, setSavingEdits] = useState(false);

  const load = async () => {
    try {
      const response = await fetch(`/api/leads/${leadId}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to load lead');
      const data = await response.json();
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!leadId) return;
    load();
  }, [leadId]);

  const saveEdits = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingEdits(true);
    setActionError(null);
    setStatusMessage(null);

    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());

    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const text = await response.text();
      if (!response.ok) throw new Error(text || 'Failed to save changes');
      setEditing(false);
      await load();
      setStatusMessage('Lead parameters updated. Valuation recalculated.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingEdits(false);
    }
  };

  if (loading) return <RequireAuth><div className="card">Loading lead...</div></RequireAuth>;
  if (error) return <RequireAuth><div className="card"><p className="error">{error}</p></div></RequireAuth>;
  if (!detail) return null;

  const { lead, intake, valuation } = detail;
  const rehabTierLabels: Record<RehabPriceModelTier, string> = {
    low_rehab_rental_almost: 'Low Rehab (rental almost)',
    mid_rehab: 'Mid Rehab',
    full_rehab_interior_cosmetics: 'Full Rehab (interior cosmetics)',
    add_exterior_cosmetics: 'Add exterior cosmetics',
    full_rehab_plus_big_ticket: 'Full rehab plus some big ticket items',
    gut_job: 'Gut Job'
  };
  const selectedTier = (intake.rehab_price_model_tier ?? 'full_rehab_interior_cosmetics') as RehabPriceModelTier;
  const sqftModel = valuation
    ? computeSqftModelOffer(valuation.baseline_market_value, intake.square_feet, selectedTier)
    : null;

  return (
    <RequireAuth>
      <div className="grid">
        <div className="card">
          <h2 className="section-title">{lead.street}</h2>
          <p className="muted">{lead.city}, {lead.state} {lead.zip}</p>
          <div className="grid grid-2" style={{ marginTop: 20 }}>
            <div>
              <p className="muted">Seller</p>
              <strong>{lead.seller_name || 'Unknown'}</strong>
              <div className="muted" style={{ marginTop: 4 }}>Created by: {lead.created_by_email || 'Unknown user'}</div>
            </div>
            {valuation ? (
              <div>
                <p className="muted">Cash Offer Range (Current Model)</p>
                <div className="kpi">${valuation.cash_offer_low.toLocaleString()} - ${valuation.cash_offer_high.toLocaleString()}</div>
                {sqftModel ? (
                  <div style={{ marginTop: 10, border: '1px solid #2563eb', borderRadius: 10, background: '#eff6ff', padding: 10 }}>
                    <p className="muted" style={{ marginTop: 0, color: '#1d4ed8' }}><strong>Cash Offer (ARV - Rehab $/SF Model)</strong></p>
                    <div className="kpi" style={{ color: '#1d4ed8' }}>${sqftModel.offer.toLocaleString()}</div>
                    <div className="muted" style={{ color: '#1d4ed8' }}>
                      {rehabTierLabels[selectedTier]} @ ${sqftModel.ppsf}/sf × {Math.round(intake.square_feet ?? 0).toLocaleString()} sf = ${sqftModel.rehabCost.toLocaleString()} rehab allowance
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          {valuation ? (
            <div style={{ marginTop: 16 }}>
              <p className="muted">Internal Listing Net Estimate</p>
              <div className="kpi">${valuation.listing_net_estimate.toLocaleString()}</div>
              <p className="muted" style={{ marginTop: 6 }}>
                This is an internal benchmark of what you might net from a traditional listing after typical selling costs and condition drag. It is not a guaranteed sale price, and it is used as a quick comparison against the cash-offer range.
              </p>
              <p className="muted" style={{ marginTop: 10 }}>Offer explanation</p>
              <ul className="muted">
                {valuation.explanation_bullets.map((bullet, index) => (
                  <li key={index}>{bullet}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="section-title" style={{ marginBottom: 0 }}>Edit Lead Inputs</h3>
            <button className="button secondary" type="button" onClick={() => setEditing((v) => !v)}>{editing ? 'Cancel' : 'Edit'}</button>
          </div>
          {editing ? (
            <form className="form" style={{ marginTop: 12 }} onSubmit={saveEdits}>
              <div className="grid grid-2">
                <label>Street<input name="street" defaultValue={lead.street} required /></label>
                <label>City<input name="city" defaultValue={lead.city} required /></label>
                <label>State<input name="state" defaultValue={lead.state} required /></label>
                <label>Zip<input name="zip" defaultValue={lead.zip} required /></label>
                <label>Seller Name<input name="seller_name" defaultValue={lead.seller_name ?? ''} /></label>
                <label>After Repair Value<input type="number" name="baseline_market_value" defaultValue={valuation?.baseline_market_value ?? 0} required min="0" /></label>
                <label>Square Feet<input type="number" name="square_feet" defaultValue={intake.square_feet ?? ''} min="0" /></label>
                <label>Bed<input type="number" name="beds" defaultValue={intake.beds ?? ''} min="0" /></label>
                <label>Bath<input type="number" name="baths" defaultValue={intake.baths ?? ''} min="0" step="0.5" /></label>

                <label>Occupancy<select name="occupancy" defaultValue={intake.occupancy}><option value="occupied">Owner Occupied</option><option value="vacant">Vacant</option><option value="tenant">Tenant Occupied</option></select></label>
                <label>Overall Condition<select name="condition_overall" defaultValue={intake.condition_overall}><option value="fixer_upper">Fixer Upper</option><option value="dated">Dated</option><option value="standard">Standard</option><option value="high_end">High End</option></select></label>
                <label>Kitchen<select name="kitchen_condition" defaultValue={intake.kitchen_condition}><option value="updated">Updated</option><option value="average">Average</option><option value="dated">Dated</option><option value="needs_replaced">Needs Replaced</option></select></label>
                <label>Bathrooms<select name="bathrooms_condition" defaultValue={intake.bathrooms_condition}><option value="updated">Updated</option><option value="average">Average</option><option value="dated">Dated</option><option value="needs_replaced">Needs Replaced</option></select></label>
                <label>Roof<select name="roof_condition" defaultValue={intake.roof_condition}><option value="new">New</option><option value="average">Average</option><option value="older">Older</option><option value="needs_replaced">Needs Replaced</option></select></label>
                <label>Mechanicals<select name="mechanicals_condition" defaultValue={intake.mechanicals_condition}><option value="new">New</option><option value="average">Average</option><option value="older">Older</option><option value="needs_replaced">Needs Replaced</option></select></label>
                <label>Electrical<select name="electrical" defaultValue={intake.electrical}><option value="updated">Updated</option><option value="fuse_knob_tube">Fuse/knob & tube</option><option value="major">Major</option></select></label>
                <label>Foundation<select name="foundation" defaultValue={intake.foundation}><option value="good">Good</option><option value="minor">Minor</option><option value="major">Major</option></select></label>
                <label style={{ border: '1px solid #2563eb', borderRadius: 8, padding: 10, background: '#eff6ff' }}>
                  <strong style={{ color: '#1d4ed8' }}>Rehab Cost Model (Price/SF)</strong>
                  <select name="rehab_price_model_tier" defaultValue={intake.rehab_price_model_tier ?? 'full_rehab_interior_cosmetics'}>
                    <option value="low_rehab_rental_almost">Low Rehab (rental almost) — $15/sf</option>
                    <option value="mid_rehab">Mid Rehab (cheaper materials, some salvageable) — $25/sf</option>
                    <option value="full_rehab_interior_cosmetics">Full Rehab (interior cosmetics) — $35/sf</option>
                    <option value="add_exterior_cosmetics">Add exterior cosmetics — $40/sf</option>
                    <option value="full_rehab_plus_big_ticket">Full rehab plus some big ticket items — $45/sf</option>
                    <option value="gut_job">Gut Job — $62/sf</option>
                  </select>
                </label>
              </div>
              <label>Notes<textarea name="notes" defaultValue={intake.notes ?? ''} /></label>
              <input type="hidden" name="include_buy_hold" value="no" />
              <input type="hidden" name="timeline" value={intake.timeline} />
              <input type="hidden" name="motivation" value={intake.motivation} />

              <button className="button" type="submit" disabled={savingEdits}>{savingEdits ? 'Saving...' : 'Save Changes'}</button>
            </form>
          ) : (
            <p className="muted" style={{ marginTop: 8 }}>Use Edit to adjust parameters after submission.</p>
          )}
          {statusMessage ? <p className="notice" style={{ marginTop: 8 }}>{statusMessage}</p> : null}
          {actionError ? <p className="error" style={{ marginTop: 8 }}>{actionError}</p> : null}
        </div>

        <div className="card">
          <h3 className="section-title">Condition Snapshot</h3>
          <div className="grid grid-2">
            <div><p className="muted">Occupancy</p><strong>{intake.occupancy}</strong></div>
            <div><p className="muted">Overall Condition</p><strong>{intake.condition_overall}</strong></div>
            <div><p className="muted">Kitchen</p><strong>{intake.kitchen_condition}</strong></div>
            <div><p className="muted">Bathrooms</p><strong>{intake.bathrooms_condition}</strong></div>
            <div><p className="muted">Bed</p><strong>{intake.beds ?? 'Unknown'}</strong></div>
            <div><p className="muted">Bath</p><strong>{intake.baths ?? 'Unknown'}</strong></div>
            <div><p className="muted">Roof</p><strong>{intake.roof_condition}</strong></div>
            <div><p className="muted">Mechanicals</p><strong>{intake.mechanicals_condition}</strong></div>
            <div><p className="muted">Electrical</p><strong>{intake.electrical}</strong></div>
            <div><p className="muted">Foundation</p><strong>{intake.foundation}</strong></div>
            <div><p className="muted">Square Feet</p><strong>{intake.square_feet ?? 'Unknown'}</strong></div>
            <div style={{ border: '1px solid #2563eb', borderRadius: 8, padding: 8, background: '#eff6ff' }}><p className="muted" style={{ color: '#1d4ed8' }}>Rehab Cost Model</p><strong style={{ color: '#1d4ed8' }}>{rehabTierLabels[selectedTier]}</strong></div>
          </div>
          {intake.notes ? <div style={{ marginTop: 12 }}><p className="muted">Notes</p><p>{intake.notes}</p></div> : null}
        </div>

        <div className="card">
          <h3 className="section-title">Photo Analysis</h3>
          <p className="muted">Photo analysis is temporarily disabled to control API costs.</p>
        </div>
      </div>
    </RequireAuth>
  );
}
