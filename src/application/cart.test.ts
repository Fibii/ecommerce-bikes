import { cartId, cartLineId } from "@/domain/cart";
import { InMemoryCartRepository } from "@/infrastructure/in-memory-cart-repository";
import {
  addToCart,
  clearCart,
  getCart,
  removeFromCart,
  type CartDeps,
} from "./cart";
import { fakeCatalog, must, sequentialIds } from "./test-support";

const CART = must(cartId("cart-1"));

function setup() {
  const deps: CartDeps = {
    catalog: fakeCatalog(),
    carts: new InMemoryCartRepository(),
    newId: sequentialIds("line"),
  };
  return deps;
}

describe("getCart", () => {
  it("shows a cart that was never saved as empty", async () => {
    const view = await getCart(setup(), CART);

    expect(view.lines).toEqual([]);
    expect(view.totals).toEqual({ net: 0, tax: 0, gross: 0 });
  });
});

describe("addToCart", () => {
  it("adds a bundle as a line priced by the server", async () => {
    const deps = setup();

    const result = await addToCart(deps, {
      cartId: CART,
      bikeId: "bike-001",
      accessories: [
        { accessoryId: "acc-001", quantity: 2 },
        { accessoryId: "acc-006", quantity: 0 },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [line] = result.value.lines;
    expect(line?.id).toBe("line-1");
    expect(line?.bike.name).toBe("Touring Voyager 5.0");
    expect(line?.accessories.map((a) => [a.accessory.id, a.quantity])).toEqual([
      ["acc-001", 2],
    ]);
    // net 899.00 + 2 x 79.90 = 1058.80; VAT 201.17; gross 1259.97
    expect(line?.price).toEqual({ net: 105880, tax: 20117, gross: 125997 });
    expect(result.value.totals).toEqual(line?.price);
  });

  it("keeps the bundle in the cart for the next read", async () => {
    const deps = setup();
    await addToCart(deps, {
      cartId: CART,
      bikeId: "bike-001",
      accessories: [],
    });

    const view = await getCart(deps, CART);

    expect(view.lines).toHaveLength(1);
  });

  it("makes two lines of the same bundle added twice", async () => {
    const deps = setup();
    const input = { cartId: CART, bikeId: "bike-001", accessories: [] };
    await addToCart(deps, input);
    await addToCart(deps, input);

    const view = await getCart(deps, CART);

    expect(view.lines.map((line) => line.id)).toEqual(["line-1", "line-2"]);
    expect(view.totals.gross).toBe(2 * 89900 + 2 * 17081);
  });

  it.each([
    [
      "an unknown bike",
      { bikeId: "bike-999", accessories: [] },
      { code: "unknown-bike", bikeId: "bike-999" },
    ],
    [
      "an unknown accessory",
      {
        bikeId: "bike-001",
        accessories: [{ accessoryId: "acc-999", quantity: 1 }],
      },
      { code: "unknown-accessory", accessoryId: "acc-999" },
    ],
    [
      "an accessory that does not fit the bike",
      {
        bikeId: "bike-003",
        accessories: [{ accessoryId: "acc-007", quantity: 1 }],
      },
      {
        code: "incompatible-accessory",
        accessoryId: "acc-007",
        frameType: "Road",
      },
    ],
    [
      "a quantity above the maximum",
      {
        bikeId: "bike-001",
        accessories: [{ accessoryId: "acc-001", quantity: 5 }],
      },
      {
        code: "quantity-out-of-range",
        accessoryId: "acc-001",
        quantity: 5,
        maxAmount: 4,
      },
    ],
    [
      "a negative quantity",
      {
        bikeId: "bike-001",
        accessories: [{ accessoryId: "acc-001", quantity: -1 }],
      },
      {
        code: "quantity-out-of-range",
        accessoryId: "acc-001",
        quantity: -1,
        maxAmount: 4,
      },
    ],
    [
      "a fractional quantity",
      {
        bikeId: "bike-001",
        accessories: [{ accessoryId: "acc-001", quantity: 1.5 }],
      },
      {
        code: "quantity-out-of-range",
        accessoryId: "acc-001",
        quantity: 1.5,
        maxAmount: 4,
      },
    ],
  ])(
    "rejects %s and leaves the cart as it was",
    async (_name, input, error) => {
      const deps = setup();

      const result = await addToCart(deps, { cartId: CART, ...input });

      expect(result).toEqual({ ok: false, error });
      expect((await getCart(deps, CART)).lines).toEqual([]);
    },
  );
});

describe("removeFromCart", () => {
  it("removes one line and keeps the others", async () => {
    const deps = setup();
    const input = { cartId: CART, bikeId: "bike-001", accessories: [] };
    await addToCart(deps, input);
    await addToCart(deps, input);

    const result = await removeFromCart(deps, {
      cartId: CART,
      lineId: must(cartLineId("line-1")),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.lines.map((line) => line.id)).toEqual(["line-2"]);
    expect((await getCart(deps, CART)).lines).toHaveLength(1);
  });

  it("reports a line that is not in the cart", async () => {
    const result = await removeFromCart(setup(), {
      cartId: CART,
      lineId: must(cartLineId("missing")),
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "line-not-found", lineId: "missing" },
    });
  });
});

describe("clearCart", () => {
  it("removes every line", async () => {
    const deps = setup();
    await addToCart(deps, {
      cartId: CART,
      bikeId: "bike-001",
      accessories: [],
    });

    const view = await clearCart(deps, CART);

    expect(view.lines).toEqual([]);
    expect((await getCart(deps, CART)).lines).toEqual([]);
  });

  it("does not touch another visitor's cart", async () => {
    const deps = setup();
    const other = must(cartId("cart-2"));
    await addToCart(deps, {
      cartId: other,
      bikeId: "bike-001",
      accessories: [],
    });

    await clearCart(deps, CART);

    expect((await getCart(deps, other)).lines).toHaveLength(1);
  });
});
