import { randomInt, randomUUID } from "node:crypto";
import path from "node:path";
import { getAvailability } from "@/application/availability";
import {
  addToCart,
  clearCart,
  getCart,
  removeFromCart,
  type AddToCartInput,
} from "@/application/cart";
import { getCatalog, getCompatibleAccessories } from "@/application/catalog";
import { checkout, type CheckoutInput } from "@/application/checkout";
import type {
  CartRepository,
  CatalogReader,
  IdempotencyStore,
  ProductId,
  StockService,
} from "@/application/ports";
import type { CartId, CartLineId } from "@/domain/cart";
import { InMemoryCartRepository } from "@/infrastructure/in-memory-cart-repository";
import { InMemoryIdempotencyStore } from "@/infrastructure/in-memory-idempotency-store";
import { JsonCatalogReader } from "@/infrastructure/json-catalog-reader";
import { SimulatedStockService } from "@/infrastructure/simulated-stock-service";

/** The adapters behind the ports. */
export type Adapters = {
  readonly catalog: CatalogReader;
  readonly carts: CartRepository;
  readonly stock: StockService;
  readonly idempotency: IdempotencyStore;
};

type Env = Readonly<Record<string, string | undefined>>;

/**
 * Creates the real adapters. This is the only place adapters are created.
 * The stock simulation is configured from the environment:
 * STOCK_FAILURE_RATE (default 0.1), STOCK_LATENCY_MIN_MS (200),
 * STOCK_LATENCY_MAX_MS (1200) and STOCK_SEED.
 */
export function createAdapters(env: Env = process.env): Adapters {
  const latencyMinMs = number(env, "STOCK_LATENCY_MIN_MS", 200, 0, 60_000);
  const latencyMaxMs = number(env, "STOCK_LATENCY_MAX_MS", 1200, 0, 60_000);
  if (latencyMaxMs < latencyMinMs) {
    throw new Error(
      "STOCK_LATENCY_MAX_MS must not be below STOCK_LATENCY_MIN_MS",
    );
  }
  return {
    catalog: new JsonCatalogReader(path.join(process.cwd(), "data")),
    carts: new InMemoryCartRepository(),
    stock: new SimulatedStockService({
      random: Math.random,
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      failureRate: number(env, "STOCK_FAILURE_RATE", 0.1, 0, 1),
      latencyMinMs,
      latencyMaxMs,
      seed: env.STOCK_SEED ?? "bikes",
    }),
    idempotency: new InMemoryIdempotencyStore(),
  };
}

/**
 * The application as pages and Route Handlers use it: every use case with its
 * ports already bound.
 */
export type App = ReturnType<typeof createApp>;

export function createApp(adapters: Adapters) {
  const { catalog, carts, stock, idempotency } = adapters;
  const newId = () => randomUUID();
  const newOrderId = () => `ORD-${randomCode(6)}`;

  return {
    getCatalog: () => getCatalog({ catalog }),
    getCompatibleAccessories: (bikeId: string) =>
      getCompatibleAccessories({ catalog }, bikeId),
    getCart: (id: CartId) => getCart({ carts }, id),
    addToCart: (input: AddToCartInput) =>
      addToCart({ catalog, carts, newId }, input),
    removeFromCart: (input: { cartId: CartId; lineId: CartLineId }) =>
      removeFromCart({ carts }, input),
    clearCart: (id: CartId) => clearCart({ carts }, id),
    getAvailability: (productIds: readonly ProductId[]) =>
      getAvailability({ stock }, productIds),
    checkout: (input: CheckoutInput) =>
      checkout({ carts, stock, idempotency, newOrderId }, input),
  };
}

const globalForApp = globalThis as typeof globalThis & {
  __bikesApp?: App;
};

/**
 * The one app of this process. It is kept on `globalThis` because Next.js
 * bundles pages and Route Handlers separately: a module-level instance would
 * be created twice, and the two would not share carts or stock.
 */
export function getApp(): App {
  globalForApp.__bikesApp ??= createApp(createAdapters());
  return globalForApp.__bikesApp;
}

function number(
  env: Env,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(
      `${name} must be a number from ${min} to ${max}, got "${raw}"`,
    );
  }
  return value;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length: number): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}
