import { addBundle, cartId, cartLineId, emptyCart } from "@/domain/cart";
import { createBundle } from "@/domain/bundle";
import { must, touringVoyager } from "@/domain/test-support";
import { InMemoryCartRepository } from "./in-memory-cart-repository";

const ID = must(cartId("cart-1"));

describe("InMemoryCartRepository", () => {
  it("reads a cart that was never saved as undefined", async () => {
    expect(await new InMemoryCartRepository().get(ID)).toBeUndefined();
  });

  it("returns the cart that was saved", async () => {
    const repository = new InMemoryCartRepository();
    const bundle = must(createBundle(touringVoyager, []));
    const cart = must(
      addBundle(emptyCart(ID), must(cartLineId("l-1")), bundle),
    );

    await repository.save(cart);

    expect(await repository.get(ID)).toEqual(cart);
  });

  it("keeps carts of different ids apart", async () => {
    const repository = new InMemoryCartRepository();
    const other = must(cartId("cart-2"));

    await repository.save(emptyCart(ID));

    expect(await repository.get(other)).toBeUndefined();
  });

  it("replaces the cart on a second save", async () => {
    const repository = new InMemoryCartRepository();
    const bundle = must(createBundle(touringVoyager, []));
    const full = must(
      addBundle(emptyCart(ID), must(cartLineId("l-1")), bundle),
    );

    await repository.save(full);
    await repository.save(emptyCart(ID));

    expect((await repository.get(ID))?.lines).toEqual([]);
  });
});
