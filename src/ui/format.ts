const euro = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "EUR",
});

/** Whole cents as euros: 143609 becomes "€1,436.09". */
export function formatMoney(cents: number): string {
  return euro.format(cents / 100);
}

/** Basis points as a percentage: 1900 becomes "19 %". */
export function formatPercent(basisPoints: number): string {
  return `${basisPoints / 100} %`;
}
