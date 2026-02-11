import { RentalAssumptions } from '@/lib/types';

type RentalInput = {
  annualRent: number;
  assumptions: RentalAssumptions;
};

export const resolveManagementPct = (assumptions: RentalAssumptions) => {
  if (assumptions.mgmt_pct !== null && Number.isFinite(assumptions.mgmt_pct)) {
    return assumptions.mgmt_pct / 100;
  }

  if (assumptions.mgmt_mode === 'third_party') {
    return 0.1;
  }

  return 0.02;
};

export const computeManagementExpense = ({ annualRent, assumptions }: RentalInput) => {
  const mgmtPct = resolveManagementPct(assumptions);
  return annualRent * mgmtPct;
};
