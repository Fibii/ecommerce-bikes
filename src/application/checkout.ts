import { cartTotals, clear, type Cart, type CartId } from "@/domain/cart";
import type { Price } from "@/domain/money";
import { quantity, type Quantity } from "@/domain/quantity";
import { err } from "@/domain/result";
import { loadCart } from "./cart";
import type {
  CartRepository,
  IdempotencyStore,
  IdGenerator,
  ProductId,
  ShortfallItem,
  StockRequest,
  StockService,
} from "./ports";
import { withTimeout } from "./timeout";

export const RESERVE_TIMEOUT_MS = 3000;

export type CheckoutDeps = {
  readonly carts: CartRepository;
  readonly stock: StockService;
  readonly idempotency: IdempotencyStore;
  readonly newOrderId: IdGenerator;
};

export type CheckoutInput = {
  readonly cartId: CartId;
  /** Sent by the client; a repeated key gets the stored outcome. */
  readonly idempotencyKey: string;
};

/** How a checkout ended. */
export type CheckoutResult =
  | {
      readonly status: "confirmed";
      readonly orderId: string;
      readonly totals: Price;
    }
  | { readonly status: "cart-empty" }
  | { readonly status: "shortfall"; readonly items: readonly ShortfallItem[] }
  | { readonly status: "stock-unavailable" };

/**
 * Places the order: reserves the stock of every item of every bundle together
 * and, if that succeeds, empties the cart.
 *
 * The reservation is the decision, and a write: a failed one is not retried,
 * because the stock service may or may not have applied it. A reservation
 * that does not answer in time counts as `stock-unavailable`. Any failure
 * leaves the cart as it was.
 *
 * Only a confirmed order is remembered under the idempotency key, so a
 * double submit does not reserve twice and "try again" can still succeed.
 */
export function checkout(
  deps: CheckoutDeps,
  input: CheckoutInput,
): Promise<CheckoutResult> {
  return deps.idempotency.run(
    `${input.cartId}:${input.idempotencyKey}`,
    () => placeOrder(deps, input.cartId),
    (result) => result.status === "confirmed",
  );
}

async function placeOrder(
  deps: CheckoutDeps,
  id: CartId,
): Promise<CheckoutResult> {
  const cart = await loadCart(deps, id);
  if (cart.lines.length === 0) return { status: "cart-empty" };

  const reservation = await withTimeout(
    deps.stock.reserve(itemsToReserve(cart)),
    RESERVE_TIMEOUT_MS,
    err({ code: "stock-unavailable" as const }),
  );
  if (!reservation.ok) {
    return reservation.error.code === "shortfall"
      ? { status: "shortfall", items: reservation.error.items }
      : { status: "stock-unavailable" };
  }

  await deps.carts.save(clear(cart));
  return {
    status: "confirmed",
    orderId: deps.newOrderId(),
    totals: cartTotals(cart),
  };
}

/** One position per product: the same accessory in two bundles is summed. */
function itemsToReserve(cart: Cart): StockRequest[] {
  const wanted = new Map<ProductId, number>();
  const add = (productId: ProductId, amount: number) =>
    wanted.set(productId, (wanted.get(productId) ?? 0) + amount);

  for (const { bundle } of cart.lines) {
    add(bundle.bike.id, 1);
    for (const { accessory, quantity } of bundle.accessories) {
      add(accessory.id, quantity);
    }
  }
  return [...wanted].map(([productId, amount]) => ({
    productId,
    quantity: asQuantity(amount),
  }));
}

function asQuantity(value: number): Quantity {
  const result = quantity(value);
  if (!result.ok) throw new Error(`Reserved amount ${value} is not a quantity`);
  return result.value;
}
