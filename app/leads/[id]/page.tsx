'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import RequireAuth from '@/components/RequireAuth';
import { supabase } from '@/lib/supabase/client';
import { IntakeAnswers, Lead, Photo, PhotoAnalysis, Valuation } from '@/lib/types';

type LeadDetail = {
  lead: Lead;
  intake: IntakeAnswers;
  valuation: Valuation | null;
  photos: Photo[];
  photoAnalysis: PhotoAnalysis | null;
  rental?: { current_rent: number | null; market_rent: number | null };
};

export default function LeadDetailPage() {
  const params = useParams();
  const leadId = useMemo(() => params.id as string, [params.id]);
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photoLoading, setPhotoLoading] = useState(false);
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
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!leadId) return;
    load();
  }, [leadId]);

  useEffect(() => {
    const hydrateUrls = async () => {
      if (!leadId) return;
      setPhotoLoading(true);
      setGalleryError(null);
      try {
        const response = await fetch(`/api/photos/signed?leadId=${encodeURIComponent(leadId)}`, {
          cache: 'no-store'
        });
        const text = await response.text();
        if (!response.ok) throw new Error(text || 'Failed to load photos');
        const payload = text ? JSON.parse(text) : { urls: [] };
        setPhotoUrls(Array.isArray(payload.urls) ? payload.urls : []);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load photos';
        setGalleryError(message);
      } finally {
        setPhotoLoading(false);
      }
    };

    hydrateUrls();
  }, [detail?.photos, leadId]);

  const uploadPhotos = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !detail) return;
    setUploading(true);
    setActionError(null);
    setStatusMessage(null);

    try {
      const uploads = Array.from(event.target.files);
      for (const file of uploads) {
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${leadId}/${Date.now()}-${sanitizedFileName}`;
        const { error: uploadError } = await supabase.storage
          .from('lead-photos')
          .upload(filePath, file, { upsert: true });

        if (uploadError) {
          console.error('Failed to upload photo', { objectPath: filePath, error: uploadError.message });
          throw uploadError;
        }

        const response = await fetch('/api/photos/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leadId,
            storagePath: filePath,
            fileName: file.name,
            contentType: file.type,
            size: file.size
          })
        });

        if (!response.ok) throw new Error('Failed to save photo metadata');
      }
      await load();
      setStatusMessage(`Uploaded ${uploads.length} photo${uploads.length === 1 ? '' : 's'}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setActionError(message);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const analyzePhotos = async () => {
    setAnalyzing(true);
    setActionError(null);
    setStatusMessage(null);
    try {
      const response = await fetch('/api/photos/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId })
      });
      const bodyText = await response.text();
      if (!response.ok) throw new Error(bodyText || 'Analysis failed');
      await load();
      setStatusMessage('Photo analysis complete. Scores updated.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed';
      setActionError(message);
    } finally {
      setAnalyzing(false);
    }
  };

  const saveEdits = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingEdits(true);
    setActionError(null);
    setStatusMessage(null);

    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());

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
      const message = err instanceof Error ? err.message : 'Save failed';
      setActionError(message);
    } finally {
      setSavingEdits(false);
    }
  };

  if (loading) {
    return (
      <RequireAuth>
        <div className="card">Loading lead...</div>
      </RequireAuth>
    );
  }

  if (error) {
    return (
      <RequireAuth>
        <div className="card">
          <p className="error">{error}</p>
        </div>
      </RequireAuth>
    );
  }

  if (!detail) return null;

  const { lead, intake, valuation, photoAnalysis } = detail;
  const analysisFlags = (photoAnalysis?.flags ?? {}) as Record<string, unknown>;

  return (
    <RequireAuth>
      <div className="grid">
        <div className="card">
          <h2 className="section-title">{lead.street}</h2>
          <p className="muted">
            {lead.city}, {lead.state} {lead.zip}
          </p>
          <div className="grid grid-2" style={{ marginTop: 20 }}>
            <div>
              <p className="muted">Seller</p>
              <strong>{lead.seller_name || 'Unknown'}</strong>
              <div className="muted">{lead.seller_phone || 'No phone'}</div>
              <div className="muted">{lead.seller_email || 'No email'}</div>
            </div>
            {valuation ? (
              <div>
                <p className="muted">Cash Offer Range</p>
                <div className="kpi">
                  ${valuation.cash_offer_low.toLocaleString()} - ${valuation.cash_offer_high.toLocaleString()}
                </div>
                <div className="muted">Confidence: {Math.round(valuation.confidence * 100)}%</div>
                <div className="badge" style={{ marginTop: 8 }}>
                  Pursue Score {valuation.pursue_score}
                </div>
              </div>
            ) : null}
          </div>
          {valuation ? (
            <div style={{ marginTop: 20 }}>
              <p className="muted">Internal Listing Net Estimate</p>
              <div className="kpi">${valuation.listing_net_estimate.toLocaleString()}</div>
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
            <button className="button secondary" type="button" onClick={() => setEditing((v) => !v)}>
              {editing ? 'Cancel' : 'Edit'}
            </button>
          </div>
          {editing ? (
            <form className="form" style={{ marginTop: 12 }} onSubmit={saveEdits}>
              <div className="grid grid-2">
                <label>Street<input name="street" defaultValue={lead.street} required /></label>
                <label>City<input name="city" defaultValue={lead.city} required /></label>
                <label>State<input name="state" defaultValue={lead.state} required /></label>
                <label>Zip<input name="zip" defaultValue={lead.zip} required /></label>
                <label>Seller Name<input name="seller_name" defaultValue={lead.seller_name ?? ''} /></label>
                <label>Seller Phone<input name="seller_phone" defaultValue={lead.seller_phone ?? ''} /></label>
                <label>Seller Email<input name="seller_email" defaultValue={lead.seller_email ?? ''} /></label>
                <label>Baseline Market Value<input type="number" name="baseline_market_value" defaultValue={valuation?.baseline_market_value ?? 0} required min="0" /></label>
                <label>Square Feet<input type="number" name="square_feet" defaultValue={intake.square_feet ?? ''} min="0" /></label>
                <label>Occupancy
                  <select name="occupancy" defaultValue={intake.occupancy}>
                    <option value="occupied">Owner Occupied</option>
                    <option value="vacant">Vacant</option>
                    <option value="tenant">Tenant Occupied</option>
                  </select>
                </label>
                <label>Timeline
                  <select name="timeline" defaultValue={intake.timeline}>
                    <option value="immediate">Immediate</option>
                    <option value="soon">Soon</option>
                    <option value="flexible">Flexible</option>
                  </select>
                </label>
                <label>Motivation
                  <select name="motivation" defaultValue={intake.motivation}>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </label>
                <label>Overall Condition
                  <select name="condition_overall" defaultValue={intake.condition_overall}>
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </label>
                <label>Kitchen & Baths
                  <select name="kitchen_baths" defaultValue={intake.kitchen_baths}>
                    <option value="updated">Updated</option>
                    <option value="average">Average</option>
                    <option value="dated">Dated</option>
                  </select>
                </label>
                <label>Roof Age<input type="number" name="roof_age" defaultValue={intake.roof_age ?? ''} min="0" /></label>
                <label>HVAC Age<input type="number" name="hvac_age" defaultValue={intake.hvac_age ?? ''} min="0" /></label>
                <label>Electrical
                  <select name="electrical" defaultValue={intake.electrical}>
                    <option value="new">New</option><option value="serviceable">Serviceable</option><option value="outdated">Outdated</option><option value="major">Major</option>
                  </select>
                </label>
                <label>Plumbing
                  <select name="plumbing" defaultValue={intake.plumbing}>
                    <option value="new">New</option><option value="serviceable">Serviceable</option><option value="outdated">Outdated</option><option value="major">Major</option>
                  </select>
                </label>
                <label>Foundation
                  <select name="foundation" defaultValue={intake.foundation}>
                    <option value="solid">Solid</option><option value="minor">Minor</option><option value="structural">Structural</option><option value="major">Major</option>
                  </select>
                </label>
                <label>Water Issues
                  <select name="water_issues" defaultValue={intake.water_issues}>
                    <option value="no">No</option><option value="yes">Yes</option>
                  </select>
                </label>
                <label>Current Rent<input type="number" name="current_rent" min="0" defaultValue={detail.rental?.current_rent ?? ''} /></label>
                <label>Market Rent<input type="number" name="market_rent" min="0" defaultValue={detail.rental?.market_rent ?? ''} /></label>
              </div>
              <label>Notes<textarea name="notes" defaultValue={intake.notes ?? ''} /></label>
              <input type="hidden" name="include_buy_hold" value="yes" />
              <button className="button" type="submit" disabled={savingEdits}>{savingEdits ? 'Saving...' : 'Save Changes'}</button>
            </form>
          ) : (
            <p className="muted" style={{ marginTop: 8 }}>Use Edit to adjust parameters after submission.</p>
          )}
        </div>

        <div className="card">
          <h3 className="section-title">Condition Snapshot</h3>
          <div className="grid grid-2">
            <div>
              <p className="muted">Occupancy</p>
              <strong>{intake.occupancy}</strong>
            </div>
            <div>
              <p className="muted">Timeline</p>
              <strong>{intake.timeline}</strong>
            </div>
            <div>
              <p className="muted">Motivation</p>
              <strong>{intake.motivation}</strong>
            </div>
            <div>
              <p className="muted">Overall Condition</p>
              <strong>{intake.condition_overall}</strong>
            </div>
            <div>
              <p className="muted">Kitchen & Baths</p>
              <strong>{intake.kitchen_baths}</strong>
            </div>
            <div>
              <p className="muted">Roof Age</p>
              <strong>{intake.roof_age ?? 'Unknown'}</strong>
            </div>
            <div>
              <p className="muted">HVAC Age</p>
              <strong>{intake.hvac_age ?? 'Unknown'}</strong>
            </div>
            <div>
              <p className="muted">Electrical</p>
              <strong>{intake.electrical}</strong>
            </div>
            <div>
              <p className="muted">Plumbing</p>
              <strong>{intake.plumbing}</strong>
            </div>
            <div>
              <p className="muted">Foundation</p>
              <strong>{intake.foundation}</strong>
            </div>
            <div>
              <p className="muted">Water Issues</p>
              <strong>{intake.water_issues}</strong>
            </div>
          </div>
          {intake.notes ? (
            <div style={{ marginTop: 12 }}>
              <p className="muted">Notes</p>
              <p>{intake.notes}</p>
            </div>
          ) : null}
        </div>

        <div className="card">
          <h3 className="section-title">Photo Gallery</h3>
          <p className="muted">Upload property photos and run analysis.</p>
          <input type="file" multiple onChange={uploadPhotos} disabled={uploading} />
          {uploading ? <p className="muted">Uploading...</p> : null}
          {photoLoading ? <p className="muted">Loading photos...</p> : null}
          {statusMessage ? <p className="notice">{statusMessage}</p> : null}
          {actionError ? <p className="error">{actionError}</p> : null}
          {galleryError ? <p className="error">{galleryError}</p> : null}
          {photoUrls.length === 0 ? <p className="muted">No photos yet.</p> : null}
          <div className="gallery" style={{ marginTop: 16 }}>
            {photoUrls.map((url) => (
              <img key={url} src={url} alt="Lead photo" />
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="section-title">Photo Analysis</h3>
          <button className="button" type="button" onClick={analyzePhotos} disabled={analyzing}>
            {analyzing ? 'Analyzing...' : 'Analyze Photos'}
          </button>
          {photoAnalysis ? (
            <div style={{ marginTop: 16 }}>
              <div className="grid grid-2">
                <div>
                  <p className="muted">Condition Score</p>
                  <div className="kpi">{photoAnalysis.condition_score}</div>
                </div>
                <div>
                  <p className="muted">Confidence</p>
                  <div className="kpi">{Math.round(photoAnalysis.confidence * 100)}%</div>
                </div>
                <div>
                  <p className="muted">Update Level</p>
                  <strong>{photoAnalysis.update_level}</strong>
                </div>
                <div>
                  <p className="muted">Rehab Tier</p>
                  <strong>{photoAnalysis.rehab_tier}</strong>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <p className="muted">Vision Signals</p>
                <ul className="muted">
                  <li>Kitchen: {String(analysisFlags.observed_kitchen ?? 'unknown')}</li>
                  <li>Overall: {String(analysisFlags.observed_overall ?? 'unknown')}</li>
                  <li>Water issues: {String(analysisFlags.observed_water_issues ?? 'unknown')}</li>
                  <li>System risk: {String(analysisFlags.observed_system_risk ?? 'unknown')}</li>
                </ul>
              </div>
              <div style={{ marginTop: 12 }}>
                <p className="muted">Observations</p>
                <ul className="muted">
                  {photoAnalysis.observations.map((obs, index) => (
                    <li key={index}>{obs}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="muted" style={{ marginTop: 12 }}>
              No analysis yet.
            </p>
          )}
        </div>
      </div>
    </RequireAuth>
  );
}
