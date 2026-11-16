import type { Bundle } from "./bundle";
import { cartId, emptyCart, type Cart } from "./cart";
import type { Cents } from "./money";
import type { Quantity } from "./quantity";
import { must, touringVoyager } from "./test-support";

// These checks run in `npm run typecheck`: each `@ts-expect-error` fails the
// type check if the line below it ever starts to compile.
describe("branded types", () => {
  it("cannot be made from a plain value, only by their constructors", () => {
    // @ts-expect-error a number is not Cents until `cents` has checked it
    const price: Cents = 1650;
    // @ts-expect-error a number is not a Quantity until `quantity` has checked it
    const amount: Quantity = 2;
    // @ts-expect-error a Bundle comes only from `createBundle`
    const bundle: Bundle = { bike: touringVoyager, accessories: [] };
    // @ts-expect-error a Cart comes only from the functions in cart.ts
    const cart: Cart = { id: must(cartId("cart-1")), lines: [] };

    expect([price, amount, bundle, cart]).toHaveLength(4);
  });

  it("do not allow a Cart to be changed in place", () => {
    const cart = emptyCart(must(cartId("cart-1")));

    // @ts-expect-error the lines of a Cart are readonly
    const push = () => cart.lines.push;
    // @ts-expect-error the lines of a Cart cannot be replaced
    const replace = () => (cart.lines = []);

    expect([push, replace]).toHaveLength(2);
  });

  it("are plain data that survives serialisation", () => {
    const cart = emptyCart(must(cartId("cart-1")));

    expect(JSON.parse(JSON.stringify(cart))).toEqual(cart);
  });
});
