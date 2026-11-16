/** @jest-environment node */
import { cartId } from "@/domain/cart";
import { bikeId } from "@/domain/bike";
import { createAdapters, createApp, getApp } from "./composition";

const FAST_AND_RELIABLE = {
  STOCK_FAILURE_RATE: "0",
  STOCK_LATENCY_MIN_MS: "0",
  STOCK_LATENCY_MAX_MS: "0",
};

function must<T>(result: { ok: true; value: T } | { ok: false }): T {
  if (!result.ok) throw new Error("expected ok");
  return result.value;
}

describe("the composition root", () => {
  it("serves the real catalog from data/", async () => {
    const app = createApp(createAdapters(FAST_AND_RELIABLE));

    const catalog = await app.getCatalog();

    expect(catalog.bikes).toHaveLength(10);
    expect(catalog.accessories).toHaveLength(16);
  });

  it("wires the use cases so a customer can configure, add and order", async () => {
    const app = createApp(createAdapters(FAST_AND_RELIABLE));
    const cart = must(cartId("cart-1"));

    const added = await app.addToCart({
      cartId: cart,
      bikeId: "bike-001",
      accessories: [{ accessoryId: "acc-006", quantity: 3 }],
    });
    expect(added.ok).toBe(true);

    const view = await app.getCart(cart);
    expect(view.lines).toHaveLength(1);
    // Net 899.00 + 3 x 16.50 = 948.50; VAT is 180.215, rounded once up to 180.22.
    expect(view.lines[0]?.price).toEqual({
      net: 94850,
      tax: 18022,
      gross: 112872,
    });

    const order = await app.checkout({ cartId: cart, idempotencyKey: "k" });
    expect(order.status).toBe("confirmed");
    expect((await app.getCart(cart)).lines).toEqual([]);

    const availability = await app.getAvailability([must(bikeId("bike-001"))]);
    expect(availability.ok).toBe(true);
  });

  it("fails every stock call when the failure rate is 1", async () => {
    const app = createApp(
      createAdapters({ ...FAST_AND_RELIABLE, STOCK_FAILURE_RATE: "1" }),
    );
    const cart = must(cartId("cart-1"));
    await app.addToCart({ cartId: cart, bikeId: "bike-001", accessories: [] });

    const order = await app.checkout({ cartId: cart, idempotencyKey: "k" });

    expect(order).toEqual({ status: "stock-unavailable" });
    expect((await app.getCart(cart)).lines).toHaveLength(1);
  });

  it("rejects a failure rate that is not between 0 and 1", () => {
    expect(() =>
      createAdapters({ ...FAST_AND_RELIABLE, STOCK_FAILURE_RATE: "2" }),
    ).toThrow("STOCK_FAILURE_RATE");
  });

  it("gives pages and Route Handlers the same app, and so the same cart", async () => {
    const first = getApp();
    const second = getApp();

    expect(second).toBe(first);
  });
});
