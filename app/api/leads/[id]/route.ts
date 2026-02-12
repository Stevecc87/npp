import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { computeValuation } from '@/lib/valuation';
import {
  ElectricalCondition,
  FoundationCondition,
  IntakeAnswers,
  PlumbingCondition
} from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const normalizeValuation = (valuation: any) => {
  if (!valuation) return null;
  return {
    ...valuation,
    baseline_market_value: Number(valuation.baseline_market_value),
    cash_offer_low: Number(valuation.cash_offer_low),
    cash_offer_high: Number(valuation.cash_offer_high),
    confidence: Number(valuation.confidence),
    pursue_score: Number(valuation.pursue_score),
    listing_net_estimate: Number(valuation.listing_net_estimate),
    explanation_bullets: Array.isArray(valuation.explanation_bullets)
      ? valuation.explanation_bullets
      : []
  };
};

const normalizePhotoAnalysis = (analysis: any) => {
  if (!analysis) return null;
  return {
    ...analysis,
    condition_score: Number(analysis.condition_score),
    confidence: Number(analysis.confidence),
    observations: Array.isArray(analysis.observations) ? analysis.observations : [],
    flags: analysis.flags ?? {}
  };
};

export async function GET(_request: Request, context: { params: { id: string } }) {
  try {
    const supabase = createSupabaseServerClient();
    const leadId = context.params.id;

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) throw leadError ?? new Error('Lead not found');

    const { data: intake, error: intakeError } = await supabase
      .from('intake_answers')
      .select('*')
      .eq('lead_id', leadId)
      .single();

    if (intakeError) throw intakeError;

    const { data: valuation } = await supabase
      .from('valuations')
      .select('*')
      .eq('lead_id', leadId)
      .single();

    const { data: photos } = await supabase
      .from('photos')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    const { data: photoAnalysis } = await supabase
      .from('photo_analysis')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: rental } = await supabase
      .from('rental_assumptions')
      .select('current_rent, market_rent')
      .eq('lead_id', leadId)
      .maybeSingle();

    return NextResponse.json({
      lead,
      intake,
      valuation: normalizeValuation(valuation),
      photos: photos ?? [],
      photoAnalysis: normalizePhotoAnalysis(photoAnalysis),
      rental: rental ?? { current_rent: null, market_rent: null }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    return new NextResponse(message, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: { id: string } }) {
  try {
    const supabase = createSupabaseServerClient();
    const leadId = context.params.id;
    const body = await request.json();

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

    const leadPayload = {
      street: String(body.street ?? '').trim(),
      city: String(body.city ?? '').trim(),
      state: String(body.state ?? '').trim(),
      zip: String(body.zip ?? '').trim(),
      seller_name: body.seller_name ? String(body.seller_name).trim() : null,
      seller_phone: body.seller_phone ? String(body.seller_phone).trim() : null,
      seller_email: body.seller_email ? String(body.seller_email).trim() : null
    };

    const answers: IntakeAnswers = {
      occupancy: String(body.occupancy ?? 'occupied'),
      timeline: String(body.timeline ?? 'soon'),
      motivation: String(body.motivation ?? 'medium'),
      condition_overall: String(body.condition_overall ?? 'good'),
      kitchen_baths: String(body.kitchen_baths ?? 'average'),
      roof_age: body.roof_age ? Number(body.roof_age) : null,
      hvac_age: body.hvac_age ? Number(body.hvac_age) : null,
      square_feet: body.square_feet ? Number(body.square_feet) : null,
      electrical: normalizeElectrical(body.electrical),
      plumbing: normalizePlumbing(body.plumbing),
      foundation: normalizeFoundation(body.foundation),
      water_issues: String(body.water_issues ?? 'no'),
      notes: body.notes ? String(body.notes) : null
    };

    const baselineMarketValue = Number(body.baseline_market_value ?? 0);
    if (!baselineMarketValue || Number.isNaN(baselineMarketValue)) {
      return new NextResponse('Baseline market value is required', { status: 400 });
    }

    const { error: leadError } = await supabase.from('leads').update(leadPayload).eq('id', leadId);
    if (leadError) throw leadError;

    const { error: intakeError } = await supabase
      .from('intake_answers')
      .update(answers)
      .eq('lead_id', leadId);
    if (intakeError) throw intakeError;

    const includeBuyHold = String(body.include_buy_hold ?? 'yes') === 'yes';
    const currentRent = body.current_rent ? Number(body.current_rent) : null;
    const marketRent = body.market_rent ? Number(body.market_rent) : null;

    if (includeBuyHold) {
      const { error: rentalError } = await supabase.from('rental_assumptions').upsert(
        {
          lead_id: leadId,
          current_rent: Number.isFinite(currentRent) ? currentRent : null,
          market_rent: Number.isFinite(marketRent) ? marketRent : null
        },
        { onConflict: 'lead_id' }
      );
      if (rentalError) throw rentalError;
    }

    let valuation = computeValuation({ baselineMarketValue, answers });

    if (
      includeBuyHold &&
      currentRent !== null &&
      marketRent !== null &&
      Number.isFinite(currentRent) &&
      Number.isFinite(marketRent) &&
      marketRent > 0
    ) {
      const rentGap = marketRent - currentRent;
      const rentGapPct = Math.max(-0.4, Math.min(0.4, rentGap / marketRent));
      const rentBumpPct = Math.max(-0.04, Math.min(0.04, rentGapPct * 0.1));

      valuation = {
        ...valuation,
        cash_offer_low: Math.max(0, Math.round(valuation.cash_offer_low * (1 + rentBumpPct))),
        cash_offer_high: Math.max(0, Math.round(valuation.cash_offer_high * (1 + rentBumpPct))),
        pursue_score: Math.max(0, Math.min(100, valuation.pursue_score + Math.round(rentGapPct * 12))),
        confidence: Number(Math.min(0.97, valuation.confidence + 0.02).toFixed(2)),
        explanation_bullets: [
          `Rent gap signal applied: current $${Math.round(currentRent).toLocaleString()}/mo vs market $${Math.round(
            marketRent
          ).toLocaleString()}/mo (${(rentGapPct * 100).toFixed(1)}% gap).`,
          ...valuation.explanation_bullets
        ]
      };
    }

    const { error: valuationError } = await supabase
      .from('valuations')
      .update({
        baseline_market_value: valuation.baseline_market_value,
        cash_offer_low: valuation.cash_offer_low,
        cash_offer_high: valuation.cash_offer_high,
        confidence: valuation.confidence,
        pursue_score: valuation.pursue_score,
        listing_net_estimate: valuation.listing_net_estimate,
        explanation_bullets: valuation.explanation_bullets
      })
      .eq('lead_id', leadId);

    if (valuationError) throw valuationError;

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    return new NextResponse(message, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: { id: string } }) {
  try {
    const supabase = createSupabaseServerClient();
    const leadId = context.params.id;

    const { error } = await supabase.from('leads').delete().eq('id', leadId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    return new NextResponse(message, { status: 500 });
  }
}
