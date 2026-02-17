'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import RequireAuth from '@/components/RequireAuth';

export default function IntakePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());

    const response = await fetch('/api/leads/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        created_by_user_id: null,
        created_by_email: null
      })
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
              <label>Street Address<input name="street" required /></label>
              <label>City<input name="city" required /></label>
              <label>Zip<input name="zip" required /></label>
              <label>Seller Name<input name="seller_name" /></label>
              <label>After Repair Value<input type="number" name="baseline_market_value" required min="0" /></label>
              <label>Square Feet<input type="number" name="square_feet" min="0" /></label>
              <label>Bed<input type="number" name="beds" min="0" /></label>
              <label>Bath<input type="number" name="baths" min="0" step="0.5" /></label>
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
                Overall Condition
                <select name="condition_overall" required>
                  <option value="fixer_upper">Fixer Upper</option>
                  <option value="dated">Dated</option>
                  <option value="rent_ready">Rent Ready</option>
                  <option value="standard">Standard</option>
                  <option value="high_end">High End</option>
                </select>
              </label>
              <label>
                Kitchen
                <select name="kitchen_condition" required>
                  <option value="updated">Updated</option>
                  <option value="average">Average</option>
                  <option value="dated">Dated</option>
                  <option value="needs_replaced">Needs Replaced</option>
                </select>
              </label>
              <label>
                Bathrooms
                <select name="bathrooms_condition" required>
                  <option value="updated">Updated</option>
                  <option value="average">Average</option>
                  <option value="dated">Dated</option>
                  <option value="needs_replaced">Needs Replaced</option>
                </select>
              </label>
              <label>
                Roof
                <select name="roof_condition" required>
                  <option value="new">New</option>
                  <option value="average">Average</option>
                  <option value="older">Older</option>
                  <option value="needs_replaced">Needs Replaced</option>
                </select>
              </label>
              <label>
                Mechanicals
                <select name="mechanicals_condition" required>
                  <option value="new">New</option>
                  <option value="average">Average</option>
                  <option value="older">Older</option>
                  <option value="needs_replaced">Needs Replaced</option>
                </select>
              </label>
              <label>
                Electrical
                <select name="electrical" required>
                  <option value="updated">Updated</option>
                  <option value="fuse_knob_tube">Fuse/knob & tube</option>
                  <option value="major">Major</option>
                </select>
              </label>
              <label>
                Foundation
                <select name="foundation" required>
                  <option value="good">Good</option>
                  <option value="minor">Minor</option>
                  <option value="major">Major</option>
                </select>
              </label>
            </div>
            <input type="hidden" name="timeline" value="soon" />
            <input type="hidden" name="motivation" value="medium" />


            <label>
              Notes
              <textarea name="notes" placeholder="Seller story, repairs, tenant notes..." />
            </label>
            {error ? <p className="error">{error}</p> : null}
            <button className="button" type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save & Compute'}</button>
          </form>
        </div>
      </div>
    </RequireAuth>
  );
}
