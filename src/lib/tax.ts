// Quebec sales tax breakdown. GST is federal (5%), QST is provincial (9.975%).
// Combined effective rate on a pre-tax subtotal is 14.975%.

export const GST_RATE = 0.05;
export const QST_RATE = 0.09975;
export const COMBINED_RATE = GST_RATE + QST_RATE;

export interface TaxBreakdown {
  subtotal: number;
  gstAmount: number;
  qstAmount: number;
  total: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculateTax(subtotal: number): TaxBreakdown {
  const sub = Math.max(0, subtotal);
  const gstAmount = round2(sub * GST_RATE);
  const qstAmount = round2(sub * QST_RATE);
  const total = round2(sub + gstAmount + qstAmount);
  return {
    subtotal: round2(sub),
    gstAmount,
    qstAmount,
    total,
  };
}
