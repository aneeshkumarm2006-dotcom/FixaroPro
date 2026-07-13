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

/**
 * Reverse of calculateTax: given a TAX-INCLUSIVE total (an all-in price the
 * customer pays, e.g. a painting bid × surplus), derive the implied pre-tax
 * subtotal + GST/QST so a stored breakdown reconciles with the total. `total`
 * is preserved exactly (the split absorbs any rounding), so line items always
 * sum back to it.
 */
export function taxInclusiveBreakdown(totalInclusive: number): TaxBreakdown {
  const total = round2(Math.max(0, totalInclusive));
  const subtotal = round2(total / (1 + COMBINED_RATE));
  const gstAmount = round2(subtotal * GST_RATE);
  const qstAmount = round2(total - subtotal - gstAmount);
  return { subtotal, gstAmount, qstAmount, total };
}
