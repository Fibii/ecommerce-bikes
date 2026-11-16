import type {
  Availability,
  ProductId,
  Shortfall,
  ShortfallItem,
  StockRequest,
  StockService,
  StockUnavailable,
} from "@/application/ports";
import { quantity, type Quantity } from "@/domain/quantity";
import { err, ok, type Result } from "@/domain/result";

export type SimulatedStockOptions = {
  /** A number in [0, 1). `Math.random` in production, a fixed function in tests. */
  random: () => number;
  /** Resolves after the given milliseconds. */
  sleep: (ms: number) => Promise<void>;
  /** Share of calls that fail with stock-unavailable, from 0 to 1. */
  failureRate: number;
  latencyMinMs: number;
  latencyMaxMs: number;
  /** Changes which products are out of stock or low. */
  seed: string;
};

/**
 * A stock service that behaves like an unreliable remote one: every call takes
 * a random time and a share of the calls fail.
 *
 * The data has no stock field, so levels are derived from the product id and
 * the seed: about one product in ten is out of stock, a few are low, the rest
 * have plenty. Levels live in memory and start again on restart.
 *
 * A call decides whether it fails before it has any effect, so a failed
 * reservation never takes stock. A successful reservation takes every
 * position or none.
 */
export class SimulatedStockService implements StockService {
  private readonly remaining = new Map<ProductId, number>();

  constructor(private readonly options: SimulatedStockOptions) {}

  async availability(
    productIds: readonly ProductId[],
  ): Promise<Result<readonly Availability[], StockUnavailable>> {
    if (await this.fails()) return err({ code: "stock-unavailable" });
    return ok(
      productIds.map((productId) => ({
        productId,
        available: asQuantity(this.levelOf(productId)),
      })),
    );
  }

  async reserve(
    items: readonly StockRequest[],
  ): Promise<Result<void, StockUnavailable | Shortfall>> {
    if (await this.fails()) return err({ code: "stock-unavailable" });

    const requested = new Map<ProductId, number>();
    for (const { productId, quantity } of items) {
      requested.set(productId, (requested.get(productId) ?? 0) + quantity);
    }

    const short: ShortfallItem[] = [];
    for (const [productId, wanted] of requested) {
      const available = this.levelOf(productId);
      if (wanted > available) {
        short.push({
          productId,
          requested: asQuantity(wanted),
          available: asQuantity(available),
        });
      }
    }
    if (short.length > 0) return err({ code: "shortfall", items: short });

    for (const [productId, wanted] of requested) {
      this.remaining.set(productId, this.levelOf(productId) - wanted);
    }
    return ok(undefined);
  }

  private async fails(): Promise<boolean> {
    const { random, sleep, latencyMinMs, latencyMaxMs, failureRate } =
      this.options;
    await sleep(latencyMinMs + random() * (latencyMaxMs - latencyMinMs));
    return random() < failureRate;
  }

  private levelOf(productId: ProductId): number {
    return (
      this.remaining.get(productId) ??
      initialLevel(productId, this.options.seed)
    );
  }
}

function asQuantity(value: number): Quantity {
  const result = quantity(value);
  if (!result.ok) throw new Error(`Stock level ${value} is not a quantity`);
  return result.value;
}

/** Out of stock, low or plentiful, from a hash of the id and the seed. */
export function initialLevel(productId: string, seed: string): number {
  const hash = fnv1a(`${seed}:${productId}`);
  const bucket = hash % 10;
  if (bucket === 0) return 0;
  if (bucket <= 2) return 1 + ((hash >>> 8) % 5); // 1 to 5
  return 6 + ((hash >>> 8) % 15); // 6 to 20
}

function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
