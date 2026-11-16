import type { Accessory } from "@/domain/accessory";
import type { Bike } from "@/domain/bike";
import {
  createBundle,
  priceBundle,
  type AccessoryQuantity,
  type BundleError,
  type QuantityOutOfRange,
} from "@/domain/bundle";
import {
  addBundle,
  cartLineId,
  cartTotals,
  clear,
  emptyCart,
  removeLine,
  type Cart,
  type CartId,
  type CartLineId,
  type LineNotFound,
} from "@/domain/cart";
import type { Price } from "@/domain/money";
import { quantity } from "@/domain/quantity";
import { err, ok, type Result } from "@/domain/result";
import type { UnknownBike } from "./catalog";
import type { CartRepository, CatalogReader, IdGenerator } from "./ports";

export type CartDeps = {
  readonly catalog: CatalogReader;
  readonly carts: CartRepository;
  readonly newId: IdGenerator;
};

/** A cart line as the customer sees it, priced by the server. */
export type CartLineView = {
  readonly id: CartLineId;
  readonly bike: Bike;
  readonly accessories: readonly AccessoryQuantity[];
  readonly price: Price;
};

/** The cart with every price computed: per line and in total. */
export type CartView = {
  readonly id: CartId;
  readonly lines: readonly CartLineView[];
  readonly totals: Price;
};

/** What the client asks for. It names products and quantities, never prices. */
export type AddToCartInput = {
  readonly cartId: CartId;
  readonly bikeId: string;
  readonly accessories: readonly {
    readonly accessoryId: string;
    readonly quantity: number;
  }[];
};

export type UnknownAccessory = {
  readonly code: "unknown-accessory";
  readonly accessoryId: string;
};

export type AddToCartError = UnknownBike | UnknownAccessory | BundleError;

export function toCartView(cart: Cart): CartView {
  return {
    id: cart.id,
    lines: cart.lines.map((line) => ({
      id: line.id,
      bike: line.bundle.bike,
      accessories: line.bundle.accessories,
      price: priceBundle(line.bundle),
    })),
    totals: cartTotals(cart),
  };
}

/** The cart of this id. One that was never saved is empty. */
export async function loadCart(
  { carts }: Pick<CartDeps, "carts">,
  id: CartId,
): Promise<Cart> {
  return (await carts.get(id)) ?? emptyCart(id);
}

export async function getCart(
  deps: Pick<CartDeps, "carts">,
  id: CartId,
): Promise<CartView> {
  return toCartView(await loadCart(deps, id));
}

/**
 * Adds a bundle as a new line. The bundle is rebuilt from the catalog, so
 * prices and compatibility come from the server whatever the client says.
 */
export async function addToCart(
  deps: CartDeps,
  input: AddToCartInput,
): Promise<Result<CartView, AddToCartError>> {
  const catalog = await deps.catalog.read();

  const bike = catalog.bikes.find((candidate) => candidate.id === input.bikeId);
  if (bike === undefined) {
    return err({ code: "unknown-bike", bikeId: input.bikeId });
  }

  const selection: AccessoryQuantity[] = [];
  for (const wanted of input.accessories) {
    const accessory = catalog.accessories.find(
      (candidate) => candidate.id === wanted.accessoryId,
    );
    if (accessory === undefined) {
      return err({
        code: "unknown-accessory",
        accessoryId: wanted.accessoryId,
      });
    }
    const amount = quantity(wanted.quantity);
    if (!amount.ok) return err(outOfRange(accessory, wanted.quantity));
    selection.push({ accessory, quantity: amount.value });
  }

  const bundle = createBundle(bike, selection);
  if (!bundle.ok) return bundle;

  const lineId = cartLineId(deps.newId());
  if (!lineId.ok) throw new Error("The id generator made an invalid line id");

  const cart = await loadCart(deps, input.cartId);
  const added = addBundle(cart, lineId.value, bundle.value);
  if (!added.ok) throw new Error("The id generator repeated a line id");

  await deps.carts.save(added.value);
  return ok(toCartView(added.value));
}

export async function removeFromCart(
  deps: Pick<CartDeps, "carts">,
  input: { readonly cartId: CartId; readonly lineId: CartLineId },
): Promise<Result<CartView, LineNotFound>> {
  const cart = await loadCart(deps, input.cartId);
  const removed = removeLine(cart, input.lineId);
  if (!removed.ok) return removed;

  await deps.carts.save(removed.value);
  return ok(toCartView(removed.value));
}

export async function clearCart(
  deps: Pick<CartDeps, "carts">,
  id: CartId,
): Promise<CartView> {
  const cart = clear(await loadCart(deps, id));
  await deps.carts.save(cart);
  return toCartView(cart);
}

function outOfRange(accessory: Accessory, value: number): QuantityOutOfRange {
  return {
    code: "quantity-out-of-range",
    accessoryId: accessory.id,
    quantity: value,
    maxAmount: accessory.maxAmount,
  };
}
