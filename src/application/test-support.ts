import type { Accessory } from "@/domain/accessory";
import type { Bike } from "@/domain/bike";
import { quantity, type Quantity } from "@/domain/quantity";
import { err, ok, type Result } from "@/domain/result";
import {
  aeroHandlebar,
  bikeComputer,
  bottleCage,
  chainLock,
  childSeat,
  childTrailer,
  fenderSet,
  helmet,
  lightSet,
  must,
  repairKit,
  rearRack,
  rockriderTrail,
  speedlineCarbonRace,
  touringVoyager,
} from "@/domain/test-support";
import type {
  Availability,
  Catalog,
  CatalogReader,
  ProductId,
  Shortfall,
  StockRequest,
  StockService,
  StockUnavailable,
} from "./ports";

export { must };

export const bikes: readonly Bike[] = [
  touringVoyager,
  speedlineCarbonRace,
  rockriderTrail,
];

export const accessories: readonly Accessory[] = [
  helmet,
  chainLock,
  lightSet,
  bikeComputer,
  bottleCage,
  repairKit,
  rearRack,
  fenderSet,
  childSeat,
  childTrailer,
  aeroHandlebar,
];

/** A catalog reader that serves the fixture products. */
export function fakeCatalog(): CatalogReader {
  const catalog: Catalog = { bikes, accessories };
  return { read: async () => catalog };
}

/** Ids "id-1", "id-2", ... so tests can name the line a use case creates. */
export function sequentialIds(prefix = "id"): () => string {
  let next = 0;
  return () => `${prefix}-${++next}`;
}

export function qty(value: number): Quantity {
  return must(quantity(value));
}

/**
 * A stock service whose answers the test controls. Products default to
 * plenty in stock. `fail`, `hang` and `stock` change what the next calls do.
 */
export class FakeStockService implements StockService {
  readonly reservations: (readonly StockRequest[])[] = [];
  availabilityCalls = 0;

  private levels = new Map<ProductId, number>();
  private failures = 0;
  private hanging = false;

  /** Sets how many of a product are in stock. */
  stock(productId: ProductId, available: number): this {
    this.levels.set(productId, available);
    return this;
  }

  /** The next `calls` calls fail with stock-unavailable. */
  fail(calls = Number.POSITIVE_INFINITY): this {
    this.failures = calls;
    return this;
  }

  /** From now on a call never answers, like a service that is down. */
  hang(): this {
    this.hanging = true;
    return this;
  }

  async availability(
    productIds: readonly ProductId[],
  ): Promise<Result<readonly Availability[], StockUnavailable>> {
    this.availabilityCalls += 1;
    if (this.hanging) return new Promise(() => undefined);
    if (this.takeFailure()) return err({ code: "stock-unavailable" });
    return ok(
      productIds.map((productId) => ({
        productId,
        available: qty(this.levelOf(productId)),
      })),
    );
  }

  async reserve(
    items: readonly StockRequest[],
  ): Promise<Result<void, StockUnavailable | Shortfall>> {
    this.reservations.push(items);
    if (this.hanging) return new Promise(() => undefined);
    if (this.takeFailure()) return err({ code: "stock-unavailable" });

    const short = items
      .filter(({ productId, quantity }) => quantity > this.levelOf(productId))
      .map(({ productId, quantity }) => ({
        productId,
        requested: quantity,
        available: qty(this.levelOf(productId)),
      }));
    if (short.length > 0) return err({ code: "shortfall", items: short });

    for (const { productId, quantity } of items) {
      this.levels.set(productId, this.levelOf(productId) - quantity);
    }
    return ok(undefined);
  }

  private levelOf(productId: ProductId): number {
    return this.levels.get(productId) ?? 100;
  }

  private takeFailure(): boolean {
    if (this.failures <= 0) return false;
    this.failures -= 1;
    return true;
  }
}
