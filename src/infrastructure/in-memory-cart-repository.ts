import type { CartRepository } from "@/application/ports";
import { emptyCart, type Cart, type CartId } from "@/domain/cart";
import type { Result } from "@/domain/result";

/** Keeps carts in memory, for one long-lived Node process. */
export class InMemoryCartRepository implements CartRepository {
  private readonly carts = new Map<CartId, Cart>();

  async get(id: CartId): Promise<Cart | undefined> {
    return this.carts.get(id);
  }

  // Atomic because nothing awaits between the read and the write.
  async update<E>(
    id: CartId,
    change: (cart: Cart) => Result<Cart, E>,
  ): Promise<Result<Cart, E>> {
    const changed = change(this.carts.get(id) ?? emptyCart(id));
    if (changed.ok) this.carts.set(id, changed.value);
    return changed;
  }
}
