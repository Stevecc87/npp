import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { computeValuation } from '@/lib/valuation';
import { purgeExpiredLeads } from '@/lib/leadRetention';
import { IntakeAnswers } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = createSupabaseServerClient();
    await purgeExpiredLeads(supabase);

    const leadPayload = {
      street: String(body.street ?? '').trim(),
      city: String(body.city ?? '').trim(),
      state: String(body.state ?? 'OH').trim() || 'OH',
      zip: String(body.zip ?? '').trim(),
      seller_name: body.seller_name ? String(body.seller_name).trim() : null,
      seller_phone: null,
      seller_email: null,
      created_by_user_id: body.created_by_user_id ? String(body.created_by_user_id).trim() : null,
      created_by_email: body.created_by_email ? String(body.created_by_email).trim().toLowerCase() : null
    };

    if (!leadPayload.street || !leadPayload.city || !leadPayload.zip) {
      return new NextResponse('Missing lead address fields', { status: 400 });
    }

    const { data: lead, error: leadError } = await supabase.from('leads').insert(leadPayload).select('*').single();
    if (leadError || !lead) throw leadError ?? new Error('Failed to create lead');

    const answers: IntakeAnswers = {
      occupancy: String(body.occupancy ?? 'occupied') as IntakeAnswers['occupancy'],
      timeline: String(body.timeline ?? 'soon') as IntakeAnswers['timeline'],
      motivation: String(body.motivation ?? 'medium') as IntakeAnswers['motivation'],
      condition_overall: String(body.condition_overall ?? 'standard') as IntakeAnswers['condition_overall'],
      kitchen_condition: String(body.kitchen_condition ?? 'average') as IntakeAnswers['kitchen_condition'],
      bathrooms_condition: String(body.bathrooms_condition ?? 'average') as IntakeAnswers['bathrooms_condition'],
      beds: body.beds ? Number(body.beds) : null,
      baths: body.baths ? Number(body.baths) : null,
      roof_condition: String(body.roof_condition ?? 'average') as IntakeAnswers['roof_condition'],
      mechanicals_condition: String(body.mechanicals_condition ?? 'average') as IntakeAnswers['mechanicals_condition'],
      square_feet: body.square_feet ? Number(body.square_feet) : null,
      electrical: String(body.electrical ?? 'updated') as IntakeAnswers['electrical'],
      foundation: String(body.foundation ?? 'good') as IntakeAnswers['foundation'],
      notes: body.notes ? String(body.notes) : null
    };

    // keep legacy non-null columns populated for compatibility
    const legacyPayload = {
      lead_id: lead.id,
      occupancy: answers.occupancy,
      timeline: answers.timeline,
      motivation: answers.motivation,
      condition_overall: answers.condition_overall,
      kitchen_baths: answers.kitchen_condition,
      roof_age:
        answers.roof_condition === 'new'
          ? 5
          : answers.roof_condition === 'average'
            ? 12
            : answers.roof_condition === 'older'
              ? 20
              : 30,
      hvac_age:
        answers.mechanicals_condition === 'new'
          ? 5
          : answers.mechanicals_condition === 'average'
            ? 12
            : answers.mechanicals_condition === 'older'
              ? 20
              : 30,
      square_feet: answers.square_feet,
      electrical:
        answers.electrical === 'updated' ? 'new' : answers.electrical === 'fuse_knob_tube' ? 'outdated' : 'major',
      plumbing: 'serviceable',
      foundation: answers.foundation === 'good' ? 'solid' : answers.foundation,
      water_issues: 'no',
      notes: answers.notes,
      kitchen_condition: answers.kitchen_condition,
      bathrooms_condition: answers.bathrooms_condition,
      roof_condition: answers.roof_condition,
      mechanicals_condition: answers.mechanicals_condition,
      full_baths: answers.baths !== null ? Math.floor(answers.baths) : null,
      half_baths:
        answers.baths !== null && Math.abs(answers.baths - Math.floor(answers.baths) - 0.5) < 0.01 ? 1 : 0,
      beds: answers.beds,
      baths: answers.baths
    };

    const { error: intakeError } = await supabase.from('intake_answers').insert(legacyPayload);
    if (intakeError) throw intakeError;

    const includeBuyHold = String(body.include_buy_hold ?? 'no') === 'yes';
    let currentRent: number | null = null;
    let marketRent: number | null = null;
    if (includeBuyHold) {
      currentRent = body.current_rent ? Number(body.current_rent) : null;
      marketRent = body.market_rent ? Number(body.market_rent) : null;
      const { error: rentalError } = await supabase.from('rental_assumptions').insert({
        lead_id: lead.id,
        current_rent: Number.isFinite(currentRent) ? currentRent : null,
        market_rent: Number.isFinite(marketRent) ? marketRent : null
      });
      if (rentalError) throw rentalError;
    }

    const baselineMarketValue = Number(body.baseline_market_value ?? 0);
    if (!baselineMarketValue || Number.isNaN(baselineMarketValue)) {
      return new NextResponse('After Repair Value is required', { status: 400 });
    }

    let valuation = computeValuation({ baselineMarketValue, answers });

    if (includeBuyHold && currentRent !== null && marketRent !== null && marketRent > 0) {
      const rentGapPct = Math.max(-0.4, Math.min(0.4, (marketRent - currentRent) / marketRent));
      const rentBumpPct = Math.max(-0.04, Math.min(0.04, rentGapPct * 0.1));
      valuation = {
        ...valuation,
        cash_offer_low: Math.max(0, Math.round(valuation.cash_offer_low * (1 + rentBumpPct))),
        cash_offer_high: Math.max(0, Math.round(valuation.cash_offer_high * (1 + rentBumpPct))),
        explanation_bullets: [
          `Rent gap signal applied: current $${Math.round(currentRent).toLocaleString()}/mo vs market $${Math.round(
            marketRent
          ).toLocaleString()}/mo (${(rentGapPct * 100).toFixed(1)}% gap).`,
          ...valuation.explanation_bullets
        ]
      };
    }

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
    console.error('create lead failed', err);
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null
          ? JSON.stringify(err)
          : 'Server error';
    return new NextResponse(message, { status: 500 });
  }
}
