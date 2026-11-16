import {
  IDEMPOTENCY_HEADER,
  checkoutResponse,
  errorResponse,
} from "@/contracts/api";

/** What the customer is told after pressing "Place order" (U9). */
export type OrderOutcome =
  | {
      readonly kind: "confirmed";
      readonly orderId: string;
      readonly gross: number;
    }
  | {
      readonly kind: "shortfall";
      readonly items: readonly {
        readonly productId: string;
        readonly requested: number;
        readonly available: number;
      }[];
    }
  | { readonly kind: "stock-unavailable" }
  | { readonly kind: "cart-empty" }
  | { readonly kind: "failed" };

/** Posts the checkout. The panel switches on status and code, never on text. */
export async function placeOrder(key: string): Promise<OrderOutcome> {
  try {
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { [IDEMPOTENCY_HEADER]: key },
    });
    const json: unknown = await response.json().catch(() => null);
    const result = checkoutResponse.safeParse(json);
    if (result.success) {
      const body = result.data;
      switch (body.status) {
        case "confirmed":
          return {
            kind: "confirmed",
            orderId: body.orderId,
            gross: body.totals.gross,
          };
        case "shortfall":
          return { kind: "shortfall", items: body.items };
        case "stock-unavailable":
          return { kind: "stock-unavailable" };
      }
    }
    const error = errorResponse.safeParse(json);
    if (error.success && error.data.error.code === "cart-empty") {
      return { kind: "cart-empty" };
    }
    return { kind: "failed" };
  } catch {
    return { kind: "failed" };
  }
}

/** Removes one line. 404 means it is already gone, which is the goal too. */
export async function removeLine(lineId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `/api/cart/lines/${encodeURIComponent(lineId)}`,
      { method: "DELETE" },
    );
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

export async function clearCart(): Promise<boolean> {
  try {
    return (await fetch("/api/cart", { method: "DELETE" })).ok;
  } catch {
    return false;
  }
}
