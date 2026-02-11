import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { computeValuation } from '@/lib/valuation';
import {
  ElectricalCondition,
  FoundationCondition,
  IntakeAnswers,
  MgmtMode,
  PlumbingCondition
} from '@/lib/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const supabase = createSupabaseServerClient();

    const leadPayload = {
      street: String(body.street ?? '').trim(),
      city: String(body.city ?? '').trim(),
      state: String(body.state ?? '').trim(),
      zip: String(body.zip ?? '').trim(),
      seller_name: body.seller_name ? String(body.seller_name).trim() : null,
      seller_phone: body.seller_phone ? String(body.seller_phone).trim() : null,
      seller_email: body.seller_email ? String(body.seller_email).trim() : null
    };

    if (!leadPayload.street || !leadPayload.city || !leadPayload.state || !leadPayload.zip) {
      return new NextResponse('Missing lead address fields', { status: 400 });
    }

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert(leadPayload)
      .select('*')
      .single();

    if (leadError || !lead) {
      throw leadError ?? new Error('Failed to create lead');
    }

    const normalizeElectrical = (value: unknown): ElectricalCondition => {
      const raw = String(value ?? 'serviceable');
      if (raw === 'modern') return 'new';
      if (['new', 'serviceable', 'outdated', 'major', 'ok', 'needs_work'].includes(raw)) {
        return raw as ElectricalCondition;
      }
      return 'serviceable';
    };

    const normalizePlumbing = (value: unknown): PlumbingCondition => {
      const raw = String(value ?? 'serviceable');
      if (raw === 'modern') return 'new';
      if (['new', 'serviceable', 'outdated', 'major', 'ok', 'needs_work'].includes(raw)) {
        return raw as PlumbingCondition;
      }
      return 'serviceable';
    };

    const normalizeFoundation = (value: unknown): FoundationCondition => {
      const raw = String(value ?? 'solid');
      if (['solid', 'minor', 'structural', 'major', 'ok', 'needs_work'].includes(raw)) {
        return raw as FoundationCondition;
      }
      return 'solid';
    };

    const normalizeMgmtMode = (value: unknown): MgmtMode => {
      const raw = String(value ?? 'self');
      if (raw === 'third_party' || raw === 'self') {
        return raw as MgmtMode;
      }
      return 'self';
    };

    const answers: IntakeAnswers = {
      occupancy: String(body.occupancy ?? 'occupied'),
      timeline: String(body.timeline ?? 'soon'),
      motivation: String(body.motivation ?? 'medium'),
      condition_overall: String(body.condition_overall ?? 'good'),
      kitchen_baths: String(body.kitchen_baths ?? 'average'),
      roof_age: body.roof_age ? Number(body.roof_age) : null,
      hvac_age: body.hvac_age ? Number(body.hvac_age) : null,
      electrical: normalizeElectrical(body.electrical),
      plumbing: normalizePlumbing(body.plumbing),
      foundation: normalizeFoundation(body.foundation),
      water_issues: String(body.water_issues ?? 'no'),
      notes: body.notes ? String(body.notes) : null
    };

    const { error: intakeError } = await supabase
      .from('intake_answers')
      .insert({ lead_id: lead.id, ...answers });

    if (intakeError) throw intakeError;

    const mgmtMode = normalizeMgmtMode(body.mgmt_mode);
    const mgmtPctRaw = body.mgmt_pct;
    const mgmtPct =
      mgmtPctRaw === null || mgmtPctRaw === undefined || String(mgmtPctRaw).trim() === ''
        ? null
        : Number(mgmtPctRaw);

    const { error: rentalError } = await supabase.from('rental_assumptions').insert({
      lead_id: lead.id,
      mgmt_mode: mgmtMode,
      mgmt_pct: Number.isFinite(mgmtPct) ? mgmtPct : null
    });

    if (rentalError) throw rentalError;

    const baselineMarketValue = Number(body.baseline_market_value ?? 0);
    if (!baselineMarketValue || Number.isNaN(baselineMarketValue)) {
      return new NextResponse('Baseline market value is required', { status: 400 });
    }

    const valuation = computeValuation({ baselineMarketValue, answers });

    const { error: valuationError } = await supabase.from('valuations').insert({
      lead_id: lead.id,
      baseline_market_value: valuation.baseline_market_value,
      cash_offer_low: valuation.cash_offer_low,
      cash_offer_high: valuation.cash_offer_high,
      confidence: valuation.confidence,
      pursue_score: valuation.pursue_score,
      listing_net_estimate: valuation.listing_net_estimate,
      explanation_bullets: valuation.explanation_bullets
    });

    if (valuationError) throw valuationError;

    return NextResponse.json({ leadId: lead.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    return new NextResponse(message, { status: 500 });
  }
}
