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
  created_by_user_id: string | null;
  created_by_email: string | null;
};

export type OverallCondition = 'fixer_upper' | 'dated' | 'rent_ready' | 'standard' | 'high_end';
export type KitchenCondition = 'updated' | 'average' | 'dated' | 'needs_replaced';
export type BathroomsCondition = 'updated' | 'average' | 'dated' | 'needs_replaced';
export type RoofCondition = 'new' | 'average' | 'older' | 'needs_replaced';
export type MechanicalsCondition = 'new' | 'average' | 'older' | 'needs_replaced';
export type ElectricalCondition = 'updated' | 'fuse_knob_tube' | 'major';
export type FoundationCondition = 'good' | 'minor' | 'major';

export type IntakeAnswers = {
  occupancy: string;
  timeline: string;
  motivation: string;
  condition_overall: OverallCondition;
  kitchen_condition: KitchenCondition;
  bathrooms_condition: BathroomsCondition;
  beds: number | null;
  baths: number | null;
  roof_condition: RoofCondition;
  mechanicals_condition: MechanicalsCondition;
  square_feet: number | null;
  electrical: ElectricalCondition;
  foundation: FoundationCondition;
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
  rehab_tier: string;
  confidence: number;
  update_level: string;
  flags: Record<string, unknown>;
  observations: string[];
};

export type RentalAssumptions = {
  current_rent: number | null;
  market_rent: number | null;
};
