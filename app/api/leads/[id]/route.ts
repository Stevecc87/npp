import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

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

    return NextResponse.json({
      lead,
      intake,
      valuation: normalizeValuation(valuation),
      photos: photos ?? [],
      photoAnalysis: normalizePhotoAnalysis(photoAnalysis)
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    return new NextResponse(message, { status: 500 });
  }
}
