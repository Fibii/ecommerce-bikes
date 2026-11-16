import { addBundle, cartId, cartLineId } from "@/domain/cart";
import { err } from "@/domain/result";
import { createBundle } from "@/domain/bundle";
import { must, touringVoyager } from "@/domain/test-support";
import { InMemoryCartRepository } from "./in-memory-cart-repository";

const ID = must(cartId("cart-1"));

describe("InMemoryCartRepository", () => {
  it("reads a cart that was never saved as undefined", async () => {
    expect(await new InMemoryCartRepository().get(ID)).toBeUndefined();
  });

  it("stores the cart an update returns", async () => {
    const repository = new InMemoryCartRepository();
    const bundle = must(createBundle(touringVoyager, []));

    const updated = await repository.update(ID, (cart) =>
      addBundle(cart, must(cartLineId("l-1")), bundle),
    );

    expect(updated.ok).toBe(true);
    expect((await repository.get(ID))?.lines).toHaveLength(1);
  });

  it("keeps carts of different ids apart", async () => {
    const repository = new InMemoryCartRepository();
    await repository.update(ID, (cart) => ({ ok: true, value: cart }));

    expect(await repository.get(must(cartId("cart-2")))).toBeUndefined();
  });

  it("stores nothing when the change fails", async () => {
    const repository = new InMemoryCartRepository();

    const updated = await repository.update(ID, () => err("nope" as const));

    expect(updated).toEqual(err("nope"));
    expect(await repository.get(ID)).toBeUndefined();
  });

  it("loses no update when several run at once", async () => {
    const repository = new InMemoryCartRepository();
    const bundle = must(createBundle(touringVoyager, []));

    await Promise.all(
      ["l-1", "l-2", "l-3"].map((line) =>
        repository.update(ID, (cart) =>
          addBundle(cart, must(cartLineId(line)), bundle),
        ),
      ),
    );

    expect((await repository.get(ID))?.lines).toHaveLength(3);
  });
});
