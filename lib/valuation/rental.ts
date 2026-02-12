import { RentalAssumptions } from '@/lib/types';

type RentalSpreadInput = {
  assumptions: RentalAssumptions;
};

export const computeRentSpread = ({ assumptions }: RentalSpreadInput) => {
  const current = assumptions.current_rent ?? 0;
  const market = assumptions.market_rent ?? 0;
  return market - current;
};
