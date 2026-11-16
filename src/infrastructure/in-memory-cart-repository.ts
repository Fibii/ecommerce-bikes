import type { CartRepository } from "@/application/ports";
import type { Cart, CartId } from "@/domain/cart";

/** Keeps carts in memory, for one long-lived Node process. */
export class InMemoryCartRepository implements CartRepository {
  private readonly carts = new Map<CartId, Cart>();

  async get(id: CartId): Promise<Cart | undefined> {
    return this.carts.get(id);
  }

  async save(cart: Cart): Promise<void> {
    this.carts.set(cart.id, cart);
  }
}
