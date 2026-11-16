import { createBundle, priceBundle } from "./bundle";
import {
  addBundle,
  cartId,
  cartLineId,
  cartTotals,
  clear,
  emptyCart,
  removeLine,
} from "./cart";
import { quantity } from "./quantity";
import {
  chainLock,
  helmet,
  must,
  rearRack,
  repairKit,
  speedlineCarbonRace,
  touringVoyager,
} from "./test-support";

const CART_ID = must(cartId("cart-1"));
const LINE_1 = must(cartLineId("line-1"));
const LINE_2 = must(cartLineId("line-2"));

const touringBundle = must(
  createBundle(touringVoyager, [
    { accessory: helmet, quantity: must(quantity(2)) },
    { accessory: chainLock, quantity: must(quantity(1)) },
    { accessory: rearRack, quantity: must(quantity(1)) },
    { accessory: repairKit, quantity: must(quantity(3)) },
  ]),
);
const roadBundle = must(createBundle(speedlineCarbonRace, []));

describe("cartId and cartLineId", () => {
  it("accept an id", () => {
    expect(cartId("cart-1")).toEqual({ ok: true, value: "cart-1" });
    expect(cartLineId("line-1")).toEqual({ ok: true, value: "line-1" });
  });

  it("reject an empty id", () => {
    const error = { code: "invalid-id", value: "" };

    expect(cartId("")).toEqual({ ok: false, error });
    expect(cartLineId("")).toEqual({ ok: false, error });
  });
});

describe("emptyCart", () => {
  it("has no lines", () => {
    expect(emptyCart(CART_ID)).toEqual({ id: "cart-1", lines: [] });
  });
});

describe("addBundle", () => {
  it("adds the bundle as one line", () => {
    const result = addBundle(emptyCart(CART_ID), LINE_1, touringBundle);

    expect(result).toEqual({
      ok: true,
      value: {
        id: "cart-1",
        lines: [{ id: "line-1", bundle: touringBundle }],
      },
    });
  });

  it("keeps the lines in the order they were added", () => {
    const one = must(addBundle(emptyCart(CART_ID), LINE_1, touringBundle));
    const two = must(addBundle(one, LINE_2, roadBundle));

    expect(two.lines.map((line) => line.id)).toEqual(["line-1", "line-2"]);
  });

  it("keeps the same bundle added twice as two lines", () => {
    const one = must(addBundle(emptyCart(CART_ID), LINE_1, touringBundle));
    const two = must(addBundle(one, LINE_2, touringBundle));

    expect(two.lines).toEqual([
      { id: "line-1", bundle: touringBundle },
      { id: "line-2", bundle: touringBundle },
    ]);
  });

  it("rejects a line id the cart already holds", () => {
    const one = must(addBundle(emptyCart(CART_ID), LINE_1, touringBundle));

    expect(addBundle(one, LINE_1, roadBundle)).toEqual({
      ok: false,
      error: { code: "duplicate-line", lineId: "line-1" },
    });
  });

  it("returns a new cart and leaves the given one unchanged", () => {
    const empty = emptyCart(CART_ID);

    const added = must(addBundle(empty, LINE_1, touringBundle));

    expect(added).not.toBe(empty);
    expect(empty.lines).toEqual([]);
  });
});

describe("removeLine", () => {
  const cart = must(
    addBundle(
      must(addBundle(emptyCart(CART_ID), LINE_1, touringBundle)),
      LINE_2,
      roadBundle,
    ),
  );

  it("removes that line and keeps the others", () => {
    expect(removeLine(cart, LINE_1)).toEqual({
      ok: true,
      value: { id: "cart-1", lines: [{ id: "line-2", bundle: roadBundle }] },
    });
  });

  it("returns line-not-found for a line the cart does not hold", () => {
    const missing = must(cartLineId("line-9"));

    expect(removeLine(cart, missing)).toEqual({
      ok: false,
      error: { code: "line-not-found", lineId: "line-9" },
    });
  });

  it("returns line-not-found when the line was already removed", () => {
    const once = must(removeLine(cart, LINE_1));

    expect(removeLine(once, LINE_1)).toEqual({
      ok: false,
      error: { code: "line-not-found", lineId: "line-1" },
    });
  });

  it("leaves the given cart unchanged", () => {
    removeLine(cart, LINE_1);

    expect(cart.lines).toHaveLength(2);
  });
});

describe("clear", () => {
  it("removes every line and keeps the cart's id", () => {
    const cart = must(addBundle(emptyCart(CART_ID), LINE_1, touringBundle));

    expect(clear(cart)).toEqual({ id: "cart-1", lines: [] });
    expect(cart.lines).toHaveLength(1);
  });

  it("leaves an empty cart empty", () => {
    expect(clear(emptyCart(CART_ID))).toEqual({ id: "cart-1", lines: [] });
  });
});

describe("cartTotals", () => {
  it("is zero for an empty cart", () => {
    expect(cartTotals(emptyCart(CART_ID))).toEqual({
      net: 0,
      tax: 0,
      gross: 0,
    });
  });

  it("is the line's price for a cart with one line", () => {
    const cart = must(addBundle(emptyCart(CART_ID), LINE_1, touringBundle));

    expect(cartTotals(cart)).toEqual(priceBundle(touringBundle));
    expect(cartTotals(cart)).toEqual({
      net: 120680,
      tax: 22929,
      gross: 143609,
    });
  });

  it("sums the line prices without rounding again", () => {
    // Each line of 1,206.80 net carries 229.29 tax (229.292 rounded once).
    // Three lines are 687.87; rounding the cart's net once would give 687.88.
    const lines = ["line-1", "line-2", "line-3"].map((id) =>
      must(cartLineId(id)),
    );
    const cart = lines.reduce(
      (current, lineId) => must(addBundle(current, lineId, touringBundle)),
      emptyCart(CART_ID),
    );

    expect(cartTotals(cart)).toEqual({
      net: 362040,
      tax: 68787,
      gross: 430827,
    });
  });
});
