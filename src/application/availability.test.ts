/** @jest-environment node */
import { bikeId } from "@/domain/bike";
import {
  AVAILABILITY_TIMEOUT_MS,
  getAvailability,
  type AvailabilityDeps,
} from "./availability";
import { FakeStockService, must } from "./test-support";

const BIKE = must(bikeId("bike-001"));

function setup() {
  const stock = new FakeStockService();
  const deps: AvailabilityDeps = { stock };
  return { stock, deps };
}

describe("getAvailability", () => {
  afterEach(() => jest.useRealTimers());

  it("returns the stock count of each product", async () => {
    const { stock, deps } = setup();
    stock.stock(BIKE, 3);

    const result = await getAvailability(deps, [BIKE]);

    expect(result).toEqual({
      ok: true,
      value: [{ productId: BIKE, available: 3 }],
    });
  });

  it("retries once, because a read is safe to repeat", async () => {
    const { stock, deps } = setup();
    stock.fail(1);

    const result = await getAvailability(deps, [BIKE]);

    expect(result.ok).toBe(true);
    expect(stock.availabilityCalls).toBe(2);
  });

  it("reports stock unavailable when the retry fails too", async () => {
    const { stock, deps } = setup();
    stock.fail();

    const result = await getAvailability(deps, [BIKE]);

    expect(result).toEqual({ ok: false, error: { code: "stock-unavailable" } });
    expect(stock.availabilityCalls).toBe(2);
  });

  it("treats a service that does not answer in time as unavailable", async () => {
    jest.useFakeTimers();
    const { stock, deps } = setup();
    stock.hang();

    const pending = getAvailability(deps, [BIKE]);
    await jest.advanceTimersByTimeAsync(2 * AVAILABILITY_TIMEOUT_MS);

    expect(await pending).toEqual({
      ok: false,
      error: { code: "stock-unavailable" },
    });
    expect(stock.availabilityCalls).toBe(2);
  });
});
