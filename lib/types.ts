export type Lead = {
  id: string;
  created_at: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  seller_name: string | null;
  seller_phone: string | null;
  seller_email: string | null;
};

export type ElectricalCondition =
  | 'new'
  | 'modern'
  | 'serviceable'
  | 'outdated'
  | 'major'
  | 'ok'
  | 'needs_work';
export type PlumbingCondition =
  | 'new'
  | 'modern'
  | 'serviceable'
  | 'outdated'
  | 'major'
  | 'ok'
  | 'needs_work';
export type FoundationCondition = 'solid' | 'minor' | 'structural' | 'major' | 'ok' | 'needs_work';

export type IntakeAnswers = {
  occupancy: string;
  timeline: string;
  motivation: string;
  condition_overall: string;
  kitchen_baths: string;
  roof_age: number | null;
  hvac_age: number | null;
  electrical: ElectricalCondition;
  plumbing: PlumbingCondition;
  foundation: FoundationCondition;
  water_issues: string;
  notes: string | null;
};

export type Valuation = {
  baseline_market_value: number;
  cash_offer_low: number;
  cash_offer_high: number;
  confidence: number;
  pursue_score: number;
  listing_net_estimate: number;
  explanation_bullets: string[];
};

export type Photo = {
  id: string;
  storage_path: string;
  file_name: string;
  content_type: string | null;
  size: number | null;
  created_at: string;
};

export type PhotoAnalysis = {
  id: string;
  created_at: string;
  condition_score: number;
  update_level: string;
  rehab_tier: string;
  confidence: number;
  flags: Record<string, unknown>;
  observations: string[];
};

export type MgmtMode = 'self' | 'third_party';

export type RentalAssumptions = {
  mgmt_mode: MgmtMode | null;
  mgmt_pct: number | null;
};
