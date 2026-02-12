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

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();

    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (leadsError) throw leadsError;

    const { data: valuations, error: valuationsError } = await supabase
      .from('valuations')
      .select('*');

    if (valuationsError) throw valuationsError;

    const leadSummaries = leads.map((lead) => {
      const valuation = valuations.find((value) => value.lead_id === lead.id) ?? null;
      return { lead, valuation: normalizeValuation(valuation) };
    });

    return NextResponse.json({ leads: leadSummaries });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    return new NextResponse(message, { status: 500 });
  }
}
