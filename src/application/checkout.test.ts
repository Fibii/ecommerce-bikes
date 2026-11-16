/** @jest-environment node */
import { accessoryId } from "@/domain/accessory";
import { cartId } from "@/domain/cart";
import { InMemoryCartRepository } from "@/infrastructure/in-memory-cart-repository";
import { InMemoryIdempotencyStore } from "@/infrastructure/in-memory-idempotency-store";
import { addToCart, getCart } from "./cart";
import {
  checkout,
  RESERVE_TIMEOUT_MS,
  type CheckoutDeps,
  type CheckoutResult,
} from "./checkout";
import {
  FakeStockService,
  fakeCatalog,
  must,
  sequentialIds,
} from "./test-support";

const CART = must(cartId("cart-1"));

function setup() {
  const stock = new FakeStockService();
  const carts = new InMemoryCartRepository();
  const deps: CheckoutDeps = {
    carts,
    stock,
    idempotency: new InMemoryIdempotencyStore(),
    newOrderId: sequentialIds("ORD"),
  };
  const cartDeps = {
    catalog: fakeCatalog(),
    carts,
    newId: sequentialIds("line"),
  };
  const fillCart = async () => {
    await addToCart(cartDeps, {
      cartId: CART,
      bikeId: "bike-001",
      accessories: [{ accessoryId: "acc-001", quantity: 2 }],
    });
    await addToCart(cartDeps, {
      cartId: CART,
      bikeId: "bike-003",
      accessories: [{ accessoryId: "acc-001", quantity: 1 }],
    });
  };
  return { stock, deps, cartDeps, fillCart };
}

const order = (key = "key-1") => ({ cartId: CART, idempotencyKey: key });

describe("checkout", () => {
  afterEach(() => jest.useRealTimers());

  it("confirms the order, reserves every item and empties the cart", async () => {
    const { stock, deps, cartDeps, fillCart } = setup();
    await fillCart();
    const totals = (await getCart(cartDeps, CART)).totals;

    const result = await checkout(deps, order());

    expect(result).toEqual({ status: "confirmed", orderId: "ORD-1", totals });
    // The same accessory in two bundles is reserved as one position of 3.
    expect(stock.reservations).toHaveLength(1);
    expect(
      [...(stock.reservations[0] ?? [])]
        .map((item) => [item.productId, item.quantity])
        .sort(),
    ).toEqual([
      ["acc-001", 3],
      ["bike-001", 1],
      ["bike-003", 1],
    ]);
    expect((await getCart(cartDeps, CART)).lines).toEqual([]);
  });

  it("refuses an empty cart without calling the stock service", async () => {
    const { stock, deps } = setup();

    const result = await checkout(deps, order());

    expect(result).toEqual({ status: "cart-empty" });
    expect(stock.reservations).toHaveLength(0);
  });

  it("reports the shortfall and leaves the cart intact", async () => {
    const { stock, deps, cartDeps, fillCart } = setup();
    await fillCart();
    stock.stock(must(accessoryId("acc-001")), 1);

    const result = await checkout(deps, order());

    expect(result).toEqual({
      status: "shortfall",
      items: [{ productId: "acc-001", requested: 3, available: 1 }],
    });
    expect((await getCart(cartDeps, CART)).lines).toHaveLength(2);
  });

  it("reports stock unavailable and leaves the cart intact", async () => {
    const { stock, deps, cartDeps, fillCart } = setup();
    await fillCart();
    stock.fail();

    const result = await checkout(deps, order());

    expect(result).toEqual({ status: "stock-unavailable" });
    expect((await getCart(cartDeps, CART)).lines).toHaveLength(2);
  });

  it("does not retry a failed reservation", async () => {
    const { stock, deps, fillCart } = setup();
    await fillCart();
    stock.fail();

    await checkout(deps, order());

    expect(stock.reservations).toHaveLength(1);
  });

  it("treats a stock service that does not answer in time as unavailable", async () => {
    jest.useFakeTimers();
    const { stock, deps, cartDeps, fillCart } = setup();
    await fillCart();
    stock.hang();

    const pending = checkout(deps, order());
    await jest.advanceTimersByTimeAsync(RESERVE_TIMEOUT_MS);

    expect(await pending).toEqual({ status: "stock-unavailable" });
    expect((await getCart(cartDeps, CART)).lines).toHaveLength(2);
  });

  it("keeps a line added while the reservation was running", async () => {
    jest.useFakeTimers();
    const { stock, deps, cartDeps, fillCart } = setup();
    await fillCart();
    stock.slowReserve(500);

    const pending = checkout(deps, order());
    await jest.advanceTimersByTimeAsync(100);
    await addToCart(cartDeps, {
      cartId: CART,
      bikeId: "bike-005",
      accessories: [],
    });
    await jest.advanceTimersByTimeAsync(500);

    expect((await pending).status).toBe("confirmed");
    const rest = (await getCart(cartDeps, CART)).lines;
    expect(rest.map((line) => line.bike.id)).toEqual(["bike-005"]);
  });

  it("does not reserve twice when the retry follows a timed-out call", async () => {
    jest.useFakeTimers();
    const { stock, deps, cartDeps, fillCart } = setup();
    await fillCart();
    stock.slowReserve(RESERVE_TIMEOUT_MS + 1000);

    const first = checkout(deps, order("key-1"));
    await jest.advanceTimersByTimeAsync(RESERVE_TIMEOUT_MS);
    expect(await first).toEqual({ status: "stock-unavailable" });

    const retry = checkout(deps, order("key-2"));
    await jest.advanceTimersByTimeAsync(1000);

    expect((await retry).status).toBe("confirmed");
    expect(stock.reservations).toHaveLength(1);
    expect((await getCart(cartDeps, CART)).lines).toEqual([]);
  });

  it("lets the customer try again after a failure", async () => {
    const { stock, deps, fillCart } = setup();
    await fillCart();
    stock.fail(1);

    const first = await checkout(deps, order("key-1"));
    const second = await checkout(deps, order("key-1"));

    expect(first.status).toBe("stock-unavailable");
    expect(second.status).toBe("confirmed");
  });

  describe("with a repeated idempotency key", () => {
    it("reserves once and returns the same order", async () => {
      const { stock, deps, fillCart } = setup();
      await fillCart();

      const first = await checkout(deps, order());
      const second = await checkout(deps, order());

      expect(second).toEqual(first);
      expect(stock.reservations).toHaveLength(1);
    });

    it("shares the result with a duplicate sent while the first runs", async () => {
      const { stock, deps, fillCart } = setup();
      await fillCart();

      const results: CheckoutResult[] = await Promise.all([
        checkout(deps, order()),
        checkout(deps, order()),
      ]);

      expect(results[1]).toEqual(results[0]);
      expect(stock.reservations).toHaveLength(1);
    });

    it("does not share an outcome between carts", async () => {
      const { deps, cartDeps, fillCart } = setup();
      await fillCart();
      const otherCart = must(cartId("cart-2"));
      await addToCart(cartDeps, {
        cartId: otherCart,
        bikeId: "bike-001",
        accessories: [],
      });

      const first = await checkout(deps, order());
      const second = await checkout(deps, {
        cartId: otherCart,
        idempotencyKey: "key-1",
      });

      expect(first.status).toBe("confirmed");
      expect(second.status).toBe("confirmed");
      expect(second).not.toEqual(first);
    });
  });
});
