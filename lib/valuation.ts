import { IntakeAnswers, RehabPriceModelTier, Valuation } from '@/lib/types';

type ComputeInput = {
  baselineMarketValue: number;
  answers: IntakeAnswers;
};

export const REHAB_PPSF_BY_TIER: Record<RehabPriceModelTier, number> = {
  low_rehab_rental_almost: 15,
  mid_rehab: 25,
  full_rehab_interior_cosmetics: 35,
  add_exterior_cosmetics: 40,
  full_rehab_plus_big_ticket: 45,
  gut_job: 62
};

export function computeSqftModelOffer(
  arv: number,
  squareFeet: number | null,
  tier: RehabPriceModelTier
): { ppsf: number; rehabCost: number; offer: number } {
  const ppsf = REHAB_PPSF_BY_TIER[tier] ?? 35;
  const sqft = squareFeet ?? 0;
  const rehabCost = Math.max(0, Math.round(sqft * ppsf));
  const offer = Math.max(0, Math.round(arv - rehabCost));
  return { ppsf, rehabCost, offer };
}

export function computeValuation({ baselineMarketValue, answers }: ComputeInput) {
  let penalty = 0.08;

  const conditionMap: Record<string, number> = {
    high_end: 0.02,
    standard: 0.06,
    dated: 0.12,
    fixer_upper: 0.2
  };

  const kitchenMap: Record<string, number> = {
    updated: 0.015,
    average: 0.04,
    dated: 0.07,
    needs_replaced: 0.1
  };

  const bathroomMap: Record<string, number> = {
    updated: 0.015,
    average: 0.04,
    dated: 0.07,
    needs_replaced: 0.1
  };

  const roofMap: Record<string, number> = {
    new: 0,
    average: 0.03,
    older: 0.06,
    needs_replaced: 0.1
  };

  const mechanicalsMap: Record<string, number> = {
    new: 0,
    average: 0.03,
    older: 0.06,
    needs_replaced: 0.1
  };

  const sf = answers.square_feet ?? null;
  const conditionSizeMultiplier =
    sf === null ? 1 : sf >= 3000 ? 1.14 : sf >= 2200 ? 1.08 : sf <= 950 ? 0.9 : 1;

  const baseConditionPenalty = conditionMap[answers.condition_overall] ?? 0.08;
  const sizedConditionPenalty = baseConditionPenalty * conditionSizeMultiplier;
  const kitchenPenalty = kitchenMap[answers.kitchen_condition] ?? 0.06;
  const bathroomsBasePenalty = bathroomMap[answers.bathrooms_condition] ?? 0.06;
  const roofPenalty = roofMap[answers.roof_condition] ?? 0.04;
  const mechanicalsPenalty = mechanicalsMap[answers.mechanicals_condition] ?? 0.04;

  penalty += sizedConditionPenalty;
  penalty += kitchenPenalty;
  penalty += bathroomsBasePenalty;
  penalty += roofPenalty;
  penalty += mechanicalsPenalty;

  if (answers.occupancy === 'tenant') {
    penalty += 0.03;
  } else if (answers.occupancy === 'occupied') {
    penalty += 0.02;
  }

  const baths = answers.baths ?? 0;
  const bathCountPenalty =
    answers.bathrooms_condition === 'dated' || answers.bathrooms_condition === 'needs_replaced'
      ? Math.min(0.03, baths * 0.005)
      : 0;
  penalty += bathCountPenalty;

  const electricalAdjustments: Record<string, { repairs: number; pct: number }> = {
    updated: { repairs: 0, pct: 0 },
    fuse_knob_tube: { repairs: 12000, pct: -0.02 },
    major: { repairs: 25000, pct: -0.05 }
  };

  const foundationAdjustments: Record<string, { repairs: number; pct: number }> = {
    good: { repairs: 0, pct: 0 },
    minor: { repairs: 7000, pct: -0.01 },
    major: { repairs: 35000, pct: -0.07 }
  };

  const electricalAdj = electricalAdjustments[answers.electrical] ?? { repairs: 0, pct: 0 };
  const foundationAdj = foundationAdjustments[answers.foundation] ?? { repairs: 0, pct: 0 };

  const systemRepairs = electricalAdj.repairs + foundationAdj.repairs;
  const systemPctHaircut = electricalAdj.pct + foundationAdj.pct;

  const base = baselineMarketValue;
  const adjusted = base * (1 - penalty);

  const baseLowPct = 0.88;
  const baseHighPct = 0.94;
  const targetLowPct = Math.max(0, baseLowPct + systemPctHaircut);
  const targetHighPct = Math.max(0, baseHighPct + systemPctHaircut);
  const cashOfferHigh = Math.max(0, Math.round(adjusted * targetHighPct - systemRepairs));
  const cashOfferLow = Math.max(0, Math.round(adjusted * targetLowPct - systemRepairs));

  const pursueScore = 0;
  const confidence = 0;

  const listingNetEstimate = Math.round(base * 0.93 - base * (penalty * 0.35));

  const sfExplanation = sf
    ? `Square footage effect: ${Math.round(sf).toLocaleString()} sf is in the ${conditionSizeMultiplier.toFixed(2)}x band, so overall-condition penalty is ${Math.round(baseConditionPenalty * 100)}% → ${Math.round(sizedConditionPenalty * 100)}% (about $${Math.round(base * (sizedConditionPenalty - baseConditionPenalty)).toLocaleString()} additional value impact before spread/repairs).`
    : 'Square footage effect: not provided, so a neutral 1.00x multiplier is used for overall-condition penalty.';

  const explanationBullets = [
    `Baseline value: $${Math.round(base).toLocaleString()}.`,
    sfExplanation,
    `Overall condition (${answers.condition_overall}): adds ${Math.round(sizedConditionPenalty * 100)}% penalty (about $${Math.round(base * sizedConditionPenalty).toLocaleString()}).`,
    `Kitchen (${answers.kitchen_condition}): adds ${Math.round(kitchenPenalty * 100)}% penalty (about $${Math.round(base * kitchenPenalty).toLocaleString()}).`,
    `Bathrooms (${answers.bathrooms_condition}): base ${Math.round(bathroomsBasePenalty * 100)}% penalty (about $${Math.round(base * bathroomsBasePenalty).toLocaleString()})${bathCountPenalty > 0 ? `, plus bath-count add-on ${Math.round(bathCountPenalty * 100)}% (about $${Math.round(base * bathCountPenalty).toLocaleString()}).` : '.'}`,
    ...(bathCountPenalty > 0
      ? [
          `Bath count (${answers.baths ?? 'unknown'}): adds ${Math.round(bathCountPenalty * 100)}% because bathroom condition is ${answers.bathrooms_condition}.`
        ]
      : []),
    `Roof (${answers.roof_condition}): adds ${Math.round(roofPenalty * 100)}% penalty (about $${Math.round(base * roofPenalty).toLocaleString()}).`,
    `Mechanicals (${answers.mechanicals_condition}): adds ${Math.round(mechanicalsPenalty * 100)}% penalty (about $${Math.round(base * mechanicalsPenalty).toLocaleString()}).`,
    ...(electricalAdj.pct === 0 && electricalAdj.repairs === 0
      ? []
      : [
          `Electrical (${answers.electrical}): spread haircut ${Math.round(electricalAdj.pct * 100)}% and repair reserve $${Math.round(electricalAdj.repairs).toLocaleString()}.`
        ]),
    ...(foundationAdj.pct === 0 && foundationAdj.repairs === 0
      ? []
      : [
          `Foundation (${answers.foundation}): spread haircut ${Math.round(foundationAdj.pct * 100)}% and repair reserve $${Math.round(foundationAdj.repairs).toLocaleString()}.`
        ]),
    `Total condition/systems penalty before spread/repairs: ~${Math.round(penalty * 100)}%.`
  ];

  const valuation: Valuation = {
    baseline_market_value: base,
    cash_offer_low: cashOfferLow,
    cash_offer_high: cashOfferHigh,
    confidence: Number(confidence.toFixed(2)),
    pursue_score: pursueScore,
    listing_net_estimate: listingNetEstimate,
    explanation_bullets: explanationBullets
  };

  return valuation;
}

export function adjustValuationFromPhotoAnalysis(valuation: Valuation, conditionScore: number, confidence: number) {
  const conditionDelta = (conditionScore - 70) / 200;
  const confidenceWeight = 0.6 + confidence * 0.4;
  const bump = conditionDelta * confidenceWeight;

  const cashOfferLow = Math.round(valuation.cash_offer_low * (1 + bump));
  const cashOfferHigh = Math.round(valuation.cash_offer_high * (1 + bump));
  return {
    ...valuation,
    cash_offer_low: cashOfferLow,
    cash_offer_high: cashOfferHigh,
    pursue_score: 0,
    confidence: Number(Math.min(0.97, valuation.confidence + confidence * 0.1).toFixed(2)),
    explanation_bullets: [...valuation.explanation_bullets, `Photo review adjusted range by ${(bump * 100).toFixed(1)}%.`]
  };
}
