import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { computeValuation } from '@/lib/valuation';
import { purgeExpiredLeads } from '@/lib/leadRetention';
import { IntakeAnswers } from '@/lib/types';

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
    explanation_bullets: Array.isArray(valuation.explanation_bullets) ? valuation.explanation_bullets : []
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
    await purgeExpiredLeads(supabase);
    const leadId = context.params.id;

    const { data: lead, error: leadError } = await supabase.from('leads').select('*').eq('id', leadId).single();
    if (leadError || !lead) throw leadError ?? new Error('Lead not found');

    const { data: intake, error: intakeError } = await supabase
      .from('intake_answers')
      .select('*')
      .eq('lead_id', leadId)
      .single();
    if (intakeError) throw intakeError;

    const { data: valuation } = await supabase.from('valuations').select('*').eq('lead_id', leadId).single();
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

    return NextResponse.json({
      lead,
      intake,
      valuation: normalizeValuation(valuation),
      photos: photos ?? [],
      photoAnalysis: normalizePhotoAnalysis(photoAnalysis)
    });
  } catch (err) {
    return new NextResponse(err instanceof Error ? err.message : 'Server error', { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: { id: string } }) {
  try {
    const supabase = createSupabaseServerClient();
    await purgeExpiredLeads(supabase);
    const leadId = context.params.id;
    const body = await request.json();

    const leadPayload = {
      street: String(body.street ?? '').trim(),
      city: String(body.city ?? '').trim(),
      state: String(body.state ?? '').trim(),
      zip: String(body.zip ?? '').trim(),
      seller_name: body.seller_name ? String(body.seller_name).trim() : null,
      seller_phone: null,
      seller_email: null
    };

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

    const baselineMarketValue = Number(body.baseline_market_value ?? 0);
    if (!baselineMarketValue || Number.isNaN(baselineMarketValue)) {
      return new NextResponse('After Repair Value is required', { status: 400 });
    }

    const { error: leadError } = await supabase.from('leads').update(leadPayload).eq('id', leadId);
    if (leadError) throw leadError;

    const intakePayload = {
      occupancy: answers.occupancy,
      timeline: answers.timeline,
      motivation: answers.motivation,
      condition_overall: answers.condition_overall,
      kitchen_baths: answers.kitchen_condition,
      roof_age:
        answers.roof_condition === 'new' ? 5 : answers.roof_condition === 'average' ? 12 : answers.roof_condition === 'older' ? 20 : 30,
      hvac_age:
        answers.mechanicals_condition === 'new'
          ? 5
          : answers.mechanicals_condition === 'average'
            ? 12
            : answers.mechanicals_condition === 'older'
              ? 20
              : 30,
      square_feet: answers.square_feet,
      electrical: answers.electrical === 'updated' ? 'new' : answers.electrical === 'fuse_knob_tube' ? 'outdated' : 'major',
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

    const { error: intakeError } = await supabase.from('intake_answers').update(intakePayload).eq('lead_id', leadId);
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
    return new NextResponse(err instanceof Error ? err.message : 'Server error', { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: { id: string } }) {
  try {
    const supabase = createSupabaseServerClient();
    await purgeExpiredLeads(supabase);
    const leadId = context.params.id;
    const { error } = await supabase.from('leads').delete().eq('id', leadId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return new NextResponse(err instanceof Error ? err.message : 'Server error', { status: 500 });
  }
}
