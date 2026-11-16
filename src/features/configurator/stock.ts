/** What the customer is told about one product's stock (U5). */
export type StockState =
  | { readonly kind: "loading" }
  | { readonly kind: "unknown" }
  | { readonly kind: "known"; readonly available: number };

export const LOW_STOCK_LIMIT = 5;

export type StockLabel = {
  readonly text: string;
  readonly tone: "neutral" | "ok" | "warn" | "danger";
};

export function stockLabel(state: StockState): StockLabel | undefined {
  if (state.kind === "loading") return undefined;
  if (state.kind === "unknown")
    return { text: "Stock unknown", tone: "neutral" };
  if (state.available === 0) return { text: "Out of stock", tone: "danger" };
  if (state.available <= LOW_STOCK_LIMIT) {
    return { text: `Only ${state.available} left`, tone: "warn" };
  }
  return { text: "In stock", tone: "ok" };
}

/** A known shortfall blocks; loading or unknown stock never does. */
export function exceedsStock(state: StockState, requested: number): boolean {
  return state.kind === "known" && requested > state.available;
}
