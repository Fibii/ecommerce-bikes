import type { Brand } from "./brand";
import { priceBundle, type Bundle } from "./bundle";
import { isValidId, type InvalidId } from "./id";
import { sumPrices, type Price } from "./money";
import { err, ok, type Result } from "./result";

export type CartId = Brand<string, "CartId">;
export type CartLineId = Brand<string, "CartLineId">;

/** One bundle in the cart. It is priced and removed as one unit. */
export type CartLine = {
  readonly id: CartLineId;
  readonly bundle: Bundle;
};

type CartContents = {
  readonly id: CartId;
  readonly lines: readonly CartLine[];
};

/**
 * The cart aggregate: a list of cart lines, each with its own id.
 * It starts as `emptyCart` and changes only through `addBundle`, `removeLine`
 * and `clear`, which return a new cart and leave the given one as it was.
 */
export type Cart = Brand<CartContents, "Cart">;

export type DuplicateLine = {
  readonly code: "duplicate-line";
  readonly lineId: CartLineId;
};

export type LineNotFound = {
  readonly code: "line-not-found";
  readonly lineId: CartLineId;
};

export function cartId(value: string): Result<CartId, InvalidId> {
  return isValidId(value)
    ? ok(value as CartId)
    : err({ code: "invalid-id", value });
}

export function cartLineId(value: string): Result<CartLineId, InvalidId> {
  return isValidId(value)
    ? ok(value as CartLineId)
    : err({ code: "invalid-id", value });
}

export function emptyCart(id: CartId): Cart {
  return cartOf(id, []);
}

/**
 * Adds the bundle as a new line at the end, under the given line id.
 * The same bundle added twice gives two lines; lines are never merged.
 */
export function addBundle(
  cart: Cart,
  lineId: CartLineId,
  bundle: Bundle,
): Result<Cart, DuplicateLine> {
  if (cart.lines.some((line) => line.id === lineId)) {
    return err({ code: "duplicate-line", lineId });
  }
  return ok(cartOf(cart.id, [...cart.lines, { id: lineId, bundle }]));
}

export function removeLine(
  cart: Cart,
  lineId: CartLineId,
): Result<Cart, LineNotFound> {
  const lines = cart.lines.filter((line) => line.id !== lineId);
  if (lines.length === cart.lines.length) {
    return err({ code: "line-not-found", lineId });
  }
  return ok(cartOf(cart.id, lines));
}

export function clear(cart: Cart): Cart {
  return emptyCart(cart.id);
}

/** The cart's net, tax and gross: the sums of its line prices. */
export function cartTotals(cart: Cart): Price {
  return sumPrices(cart.lines.map((line) => priceBundle(line.bundle)));
}

function cartOf(id: CartId, lines: readonly CartLine[]): Cart {
  const cart: CartContents = { id, lines };
  return cart as Cart;
}
