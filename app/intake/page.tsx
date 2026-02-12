'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import RequireAuth from '@/components/RequireAuth';

export default function IntakePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeBuyHold, setIncludeBuyHold] = useState(true);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    const payload = Object.fromEntries(formData.entries());

    const response = await fetch('/api/leads/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const message = await response.text();
      setError(message || 'Failed to create lead');
      setLoading(false);
      return;
    }

    const data = await response.json();
    router.push(`/leads/${data.leadId}`);
  };

  return (
    <RequireAuth>
      <div className="grid">
        <div className="card">
          <h2 className="section-title">Call Intake</h2>
          <p className="muted">Capture the seller story and get an instant valuation band.</p>
          <form className="form" onSubmit={submit}>
            <div className="grid grid-2">
              <label>
                Street Address
                <input name="street" required />
              </label>
              <label>
                City
                <input name="city" required />
              </label>
              <label>
                State
                <input name="state" required />
              </label>
              <label>
                Zip
                <input name="zip" required />
              </label>
              <label>
                Seller Name
                <input name="seller_name" />
              </label>
              <label>
                Seller Phone
                <input name="seller_phone" />
              </label>
              <label>
                Seller Email
                <input type="email" name="seller_email" />
              </label>
              <label>
                Baseline Market Value
                <input type="number" name="baseline_market_value" required min="0" />
              </label>
              <label>
                Square Feet
                <input type="number" name="square_feet" min="0" />
              </label>
            </div>

            <div className="grid grid-2">
              <label>
                Occupancy
                <select name="occupancy" required>
                  <option value="occupied">Owner Occupied</option>
                  <option value="vacant">Vacant</option>
                  <option value="tenant">Tenant Occupied</option>
                </select>
              </label>
              <label>
                Timeline
                <select name="timeline" required>
                  <option value="immediate">Immediate (0-30 days)</option>
                  <option value="soon">Soon (30-90 days)</option>
                  <option value="flexible">Flexible (90+ days)</option>
                </select>
              </label>
              <label>
                Motivation
                <select name="motivation" required>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>
              <label>
                Overall Condition
                <select name="condition_overall" required>
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                </select>
              </label>
              <label>
                Kitchen & Baths
                <select name="kitchen_baths" required>
                  <option value="updated">Updated</option>
                  <option value="average">Average</option>
                  <option value="dated">Dated</option>
                </select>
              </label>
              <label>
                Roof Age (years)
                <input type="number" name="roof_age" min="0" />
              </label>
              <label>
                HVAC Age (years)
                <input type="number" name="hvac_age" min="0" />
              </label>
              <label>
                Electrical
                <select name="electrical" required>
                  <option value="new">New</option>
                  <option value="serviceable">Serviceable</option>
                  <option value="outdated">Outdated</option>
                  <option value="major">Major</option>
                </select>
              </label>
              <label>
                Plumbing
                <select name="plumbing" required>
                  <option value="new">New</option>
                  <option value="serviceable">Serviceable</option>
                  <option value="outdated">Outdated</option>
                  <option value="major">Major</option>
                </select>
              </label>
              <label>
                Foundation
                <select name="foundation" required>
                  <option value="solid">Solid</option>
                  <option value="minor">Minor</option>
                  <option value="structural">Structural</option>
                  <option value="major">Major</option>
                </select>
              </label>
              <label>
                Water Issues
                <select name="water_issues" required>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </label>
            </div>
            <div className="card" style={{ marginTop: 16 }}>
              <h3 className="section-title">Buy & Hold Rental</h3>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <input
                  type="checkbox"
                  checked={includeBuyHold}
                  onChange={(event) => setIncludeBuyHold(event.target.checked)}
                />
                Include rental assumptions for this deal
              </label>
              <input type="hidden" name="include_buy_hold" value={includeBuyHold ? 'yes' : 'no'} />
              <div className="grid grid-2">
                <label>
                  Current Rent ($/mo)
                  <input type="number" name="current_rent" min="0" step="1" disabled={!includeBuyHold} />
                </label>
                <label>
                  Market Rent ($/mo)
                  <input type="number" name="market_rent" min="0" step="1" disabled={!includeBuyHold} />
                </label>
              </div>
            </div>
            <label>
              Notes
              <textarea name="notes" placeholder="Seller story, repairs, tenant notes..." />
            </label>
            {error ? <p className="error">{error}</p> : null}
            <button className="button" type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save & Compute'}
            </button>
          </form>
        </div>
      </div>
    </RequireAuth>
  );
}
