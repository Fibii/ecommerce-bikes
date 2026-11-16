import type { ProductId } from "@/application/ports";
import { accessoryId } from "@/domain/accessory";
import { bikeId } from "@/domain/bike";
import { quantity } from "@/domain/quantity";
import { must } from "@/domain/test-support";
import {
  SimulatedStockService,
  initialLevel,
  type SimulatedStockOptions,
} from "./simulated-stock-service";

const never = () => 0.99; // never below a failure rate under 1
const always = () => 0; // always below a failure rate above 0

function service(overrides: Partial<SimulatedStockOptions> = {}) {
  const sleeps: number[] = [];
  const stock = new SimulatedStockService({
    random: never,
    sleep: async (ms) => void sleeps.push(ms),
    failureRate: 0.1,
    latencyMinMs: 200,
    latencyMaxMs: 1200,
    seed: "test",
    ...overrides,
  });
  return { stock, sleeps };
}

const CATALOG_IDS: ProductId[] = [
  ...Array.from({ length: 10 }, (_, i) =>
    must(bikeId(`bike-${String(i + 1).padStart(3, "0")}`)),
  ),
  ...Array.from({ length: 16 }, (_, i) =>
    must(accessoryId(`acc-${String(i + 1).padStart(3, "0")}`)),
  ),
];

const asked = (productId: ProductId, amount: number) => ({
  productId,
  quantity: must(quantity(amount)),
});

describe("stock levels", () => {
  it("are the same for the same seed and product", () => {
    expect(initialLevel("acc-001", "s")).toBe(initialLevel("acc-001", "s"));
  });

  it("include out of stock, low and plentiful products in the catalog", () => {
    const levels = CATALOG_IDS.map((id) => initialLevel(id, "bikes"));

    expect(levels.some((level) => level === 0)).toBe(true);
    expect(levels.some((level) => level >= 1 && level <= 5)).toBe(true);
    expect(levels.some((level) => level > 5)).toBe(true);
  });
});

describe("availability", () => {
  it("reports the level of every product asked for", async () => {
    const { stock } = service();
    const [first, second] = CATALOG_IDS as [ProductId, ProductId];

    const result = await stock.availability([first, second]);

    expect(result).toEqual({
      ok: true,
      value: [
        { productId: first, available: initialLevel(first, "test") },
        { productId: second, available: initialLevel(second, "test") },
      ],
    });
  });

  it("waits a time between the minimum and the maximum latency", async () => {
    const { stock, sleeps } = service({ random: () => 0.5 });

    await stock.availability([]);

    expect(sleeps).toEqual([700]);
  });

  it("fails with stock-unavailable at the failure rate", async () => {
    const { stock } = service({ random: always });

    expect(await stock.availability([])).toEqual({
      ok: false,
      error: { code: "stock-unavailable" },
    });
  });

  it("never fails at a failure rate of 0", async () => {
    const { stock } = service({ random: always, failureRate: 0 });

    expect((await stock.availability([])).ok).toBe(true);
  });
});

describe("reserve", () => {
  const plenty = CATALOG_IDS.find((id) => initialLevel(id, "test") >= 6)!;
  const none = CATALOG_IDS.find((id) => initialLevel(id, "test") === 0)!;

  it("takes the stock, so availability drops by the reserved quantity", async () => {
    const { stock } = service();
    const before = initialLevel(plenty, "test");

    expect((await stock.reserve([asked(plenty, 2)])).ok).toBe(true);

    expect(await stock.availability([plenty])).toEqual({
      ok: true,
      value: [{ productId: plenty, available: before - 2 }],
    });
  });

  it("adds up a product asked for in several positions", async () => {
    const { stock } = service();
    const level = initialLevel(plenty, "test");

    const result = await stock.reserve([
      asked(plenty, level),
      asked(plenty, 1),
    ]);

    expect(result).toEqual({
      ok: false,
      error: {
        code: "shortfall",
        items: [{ productId: plenty, requested: level + 1, available: level }],
      },
    });
  });

  it("reports every short product and takes nothing", async () => {
    const { stock } = service();
    const before = initialLevel(plenty, "test");

    const result = await stock.reserve([asked(plenty, 1), asked(none, 1)]);

    expect(result).toEqual({
      ok: false,
      error: {
        code: "shortfall",
        items: [{ productId: none, requested: 1, available: 0 }],
      },
    });
    expect(await stock.availability([plenty])).toEqual({
      ok: true,
      value: [{ productId: plenty, available: before }],
    });
  });

  it("takes no stock when the call fails", async () => {
    let failing = true;
    const { stock } = service({
      random: () => (failing ? 0 : 0.99),
    });
    const before = initialLevel(plenty, "test");

    expect(await stock.reserve([asked(plenty, 1)])).toEqual({
      ok: false,
      error: { code: "stock-unavailable" },
    });
    failing = false;

    expect(await stock.availability([plenty])).toEqual({
      ok: true,
      value: [{ productId: plenty, available: before }],
    });
  });
});
