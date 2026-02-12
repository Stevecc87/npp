import { IntakeAnswers, Valuation } from '@/lib/types';

type ComputeInput = {
  baselineMarketValue: number;
  answers: IntakeAnswers;
};

export function computeValuation({ baselineMarketValue, answers }: ComputeInput) {
  const penaltyFactors: string[] = [];
  let penalty = 0.08;

  const conditionMap: Record<string, number> = {
    excellent: 0.02,
    good: 0.05,
    fair: 0.1,
    poor: 0.18
  };

  const kitchenMap: Record<string, number> = {
    updated: 0.03,
    average: 0.06,
    dated: 0.1
  };

  const sf = answers.square_feet ?? null;
  const conditionSizeMultiplier =
    sf === null ? 1 : sf >= 3000 ? 1.25 : sf >= 2000 ? 1.12 : sf <= 1200 ? 0.9 : 1;

  penalty += (conditionMap[answers.condition_overall] ?? 0.07) * conditionSizeMultiplier;
  penalty += (kitchenMap[answers.kitchen_baths] ?? 0.05) * conditionSizeMultiplier;

  if (answers.roof_age !== null) {
    if (answers.roof_age > 20) {
      penalty += 0.06;
      penaltyFactors.push('Roof is beyond typical lifecycle (20+ years).');
    } else if (answers.roof_age > 10) {
      penalty += 0.03;
    } else {
      penalty += 0.01;
    }
  }

  if (answers.hvac_age !== null) {
    if (answers.hvac_age > 15) {
      penalty += 0.05;
      penaltyFactors.push('HVAC likely nearing replacement timeline.');
    } else if (answers.hvac_age > 8) {
      penalty += 0.025;
    } else {
      penalty += 0.01;
    }
  }

  const normalizeElectrical = (value: IntakeAnswers['electrical']) => {
    if (value === 'ok') return 'serviceable';
    if (value === 'needs_work') return 'outdated';
    if (value === 'modern') return 'new';
    return value;
  };

  const normalizePlumbing = (value: IntakeAnswers['plumbing']) => {
    if (value === 'ok') return 'serviceable';
    if (value === 'needs_work') return 'outdated';
    if (value === 'modern') return 'new';
    return value;
  };

  const normalizeFoundation = (value: IntakeAnswers['foundation']) => {
    if (value === 'ok') return 'solid';
    if (value === 'needs_work') return 'minor';
    return value;
  };

  const electrical = normalizeElectrical(answers.electrical);
  const plumbing = normalizePlumbing(answers.plumbing);
  const foundation = normalizeFoundation(answers.foundation);

  const electricalAdjustments: Record<string, { repairs: number; pct: number }> = {
    new: { repairs: 0, pct: 0 },
    serviceable: { repairs: 2500, pct: 0 },
    outdated: { repairs: 7500, pct: -0.01 },
    major: { repairs: 17500, pct: -0.03 }
  };

  const plumbingAdjustments: Record<string, { repairs: number; pct: number }> = {
    new: { repairs: 0, pct: 0 },
    serviceable: { repairs: 2500, pct: 0 },
    outdated: { repairs: 7500, pct: -0.01 },
    major: { repairs: 20000, pct: -0.03 }
  };

  const foundationAdjustments: Record<string, { repairs: number; pct: number }> = {
    solid: { repairs: 0, pct: 0 },
    minor: { repairs: 5000, pct: -0.01 },
    structural: { repairs: 25000, pct: -0.05 },
    major: { repairs: 50000, pct: -0.1 }
  };

  const formatTier = (value: string) =>
    value
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const systems = [
    { label: 'Electrical', value: electrical, map: electricalAdjustments },
    { label: 'Plumbing', value: plumbing, map: plumbingAdjustments },
    { label: 'Foundation', value: foundation, map: foundationAdjustments }
  ];

  let systemRepairs = 0;
  let systemPctHaircut = 0;

  for (const system of systems) {
    const adjustment = system.map[system.value] ?? { repairs: 0, pct: 0 };
    systemRepairs += adjustment.repairs;
    systemPctHaircut += adjustment.pct;
    if (adjustment.repairs > 0 || adjustment.pct < 0) {
      penaltyFactors.push(`${system.label} condition: ${formatTier(system.value)}.`);
    }
  }

  if (answers.water_issues === 'yes') {
    penalty += 0.07 * conditionSizeMultiplier;
    penaltyFactors.push('Water intrusion risk noted.');
  }

  if (answers.occupancy === 'tenant') {
    penalty += 0.03;
  } else if (answers.occupancy === 'occupied') {
    penalty += 0.02;
  }

  const base = baselineMarketValue;
  const adjusted = base * (1 - penalty);

  const baseLowPct = 0.88;
  const baseHighPct = 0.94;
  const targetLowPct = Math.max(0, baseLowPct + systemPctHaircut);
  const targetHighPct = Math.max(0, baseHighPct + systemPctHaircut);
  const cashOfferHigh = Math.max(0, Math.round(adjusted * targetHighPct - systemRepairs));
  const cashOfferLow = Math.max(0, Math.round(adjusted * targetLowPct - systemRepairs));

  const systemPenaltyForScore =
    (base > 0 ? systemRepairs / base : 0) + Math.max(0, -systemPctHaircut);
  let pursueScore = Math.round(78 - (penalty + systemPenaltyForScore) * 100);
  if (answers.motivation === 'high') pursueScore += 8;
  if (answers.motivation === 'low') pursueScore -= 6;
  if (answers.timeline === 'immediate') pursueScore += 5;
  if (answers.timeline === 'flexible') pursueScore -= 3;
  pursueScore = Math.max(0, Math.min(100, pursueScore));

  let confidence = 0.58;
  if (answers.notes && answers.notes.length > 20) confidence += 0.07;
  if (answers.motivation === 'high') confidence += 0.06;
  if (answers.roof_age !== null && answers.hvac_age !== null) confidence += 0.05;
  confidence = Math.min(0.92, confidence);

  const listingNetEstimate = Math.round(base * 0.93 - base * (penalty * 0.35));

  if (systemRepairs > 0) {
    const haircutPct = Math.abs(systemPctHaircut * 100);
    if (haircutPct > 0) {
      penaltyFactors.unshift(
        `Systems add ~$${Math.round(systemRepairs).toLocaleString()} repairs and ${haircutPct.toFixed(1)}% haircut.`
      );
    } else {
      penaltyFactors.unshift(
        `Systems add ~$${Math.round(systemRepairs).toLocaleString()} repairs.`
      );
    }
  } else if (systemPctHaircut < 0) {
    const haircutPct = Math.abs(systemPctHaircut * 100);
    penaltyFactors.unshift(`Systems apply a ${haircutPct.toFixed(1)}% haircut.`);
  }

  const explanationBullets = [
    `Baseline value: $${Math.round(base).toLocaleString()}.`,
    `Condition and operating factors reduce value by ~${Math.round(penalty * 100)}%.`,
    ...penaltyFactors.slice(0, 3)
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
  const pursueScore = Math.max(
    0,
    Math.min(100, Math.round(valuation.pursue_score + bump * 60))
  );

  return {
    ...valuation,
    cash_offer_low: cashOfferLow,
    cash_offer_high: cashOfferHigh,
    pursue_score: pursueScore,
    confidence: Number(Math.min(0.97, valuation.confidence + confidence * 0.1).toFixed(2)),
    explanation_bullets: [
      ...valuation.explanation_bullets,
      `Photo review adjusted range by ${(bump * 100).toFixed(1)}%.`
    ]
  };
}
