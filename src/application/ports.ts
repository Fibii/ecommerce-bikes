import type { AccessoryId, Accessory } from "@/domain/accessory";
import type { Bike, BikeId } from "@/domain/bike";
import type { Cart, CartId } from "@/domain/cart";
import type { Quantity } from "@/domain/quantity";
import type { Result } from "@/domain/result";

/** A product the stock service knows: a bike or an accessory. */
export type ProductId = BikeId | AccessoryId;

/** Everything the shop sells. Prices are net, in cents. */
export type Catalog = {
  readonly bikes: readonly Bike[];
  readonly accessories: readonly Accessory[];
};

/**
 * Where the catalog comes from. A catalog that cannot be read or is invalid is
 * a bug, not an expected failure, so `read` rejects instead of returning a
 * Result.
 */
export interface CatalogReader {
  read(): Promise<Catalog>;
}

/**
 * Where carts are kept. A cart that was never saved reads as `undefined`;
 * the use cases treat that as an empty cart.
 *
 * `update` is the only write. It applies `change`, a pure function of the
 * current cart (an empty one if none was saved), and stores the new cart only
 * if `change` succeeds. Updates of the same cart never interleave, so none is
 * lost: a database adapter would run it in one transaction.
 */
export interface CartRepository {
  get(id: CartId): Promise<Cart | undefined>;
  update<E>(
    id: CartId,
    change: (cart: Cart) => Result<Cart, E>,
  ): Promise<Result<Cart, E>>;
}

/** The stock service did not answer in time or answered with an error. */
export type StockUnavailable = { readonly code: "stock-unavailable" };

export type Availability = {
  readonly productId: ProductId;
  readonly available: Quantity;
};

export type StockRequest = {
  readonly productId: ProductId;
  readonly quantity: Quantity;
};

/** One product that cannot be reserved in the quantity asked for. */
export type ShortfallItem = {
  readonly productId: ProductId;
  readonly requested: Quantity;
  readonly available: Quantity;
};

export type Shortfall = {
  readonly code: "shortfall";
  readonly items: readonly ShortfallItem[];
};

/**
 * The stock service. `availability` is a hint for the customer;
 * `reserve` is the decision, and takes all positions or none.
 * Both can fail with `stock-unavailable`.
 */
export interface StockService {
  availability(
    productIds: readonly ProductId[],
  ): Promise<Result<readonly Availability[], StockUnavailable>>;
  reserve(
    items: readonly StockRequest[],
  ): Promise<Result<void, StockUnavailable | Shortfall>>;
}

/**
 * Makes a request safe to repeat. `run` does the work once per key and gives
 * a repeated key the stored outcome; a duplicate that arrives while the work
 * is still running shares its result. An outcome is kept only if `keep`
 * returns true for it.
 */
export interface IdempotencyStore {
  run<T>(
    key: string,
    work: () => Promise<T>,
    keep: (outcome: T) => boolean,
  ): Promise<T>;
}

/** Makes a new unique id. A port so that tests can use fixed ids. */
export type IdGenerator = () => string;
