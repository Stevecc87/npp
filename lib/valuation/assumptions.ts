export const REHAB_PER_SF_DEFAULTS: Record<string, number> = {
  excellent: 8,
  good: 12,
  fair: 16,
  poor: 22
};

// Used by intake preset dropdown labels.
export const REHAB_PER_SF_PRESETS = [
  { key: 'excellent', value: 8, label: 'Excellent ($8/sf)' },
  { key: 'good', value: 12, label: 'Good ($12/sf)' },
  { key: 'fair', value: 16, label: 'Fair ($16/sf)' },
  { key: 'poor', value: 22, label: 'Poor ($22/sf)' }
] as const;
