import { cookies } from "next/headers";
import { Suspense } from "react";
import { CART_COOKIE } from "@/contracts/api";
import { cartId } from "@/domain/cart";
import { CartScreen } from "@/features/cart/cart-screen";
import { getApp } from "@/server/composition";

async function LoadedCart() {
  const value = (await cookies()).get(CART_COOKIE)?.value;
  const id = value === undefined ? undefined : cartId(value);
  const cart = id?.ok ? await getApp().getCart(id.value) : undefined;
  return <CartScreen cart={cart ?? null} />;
}

export default function CartPage() {
  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <h1 className="mb-6 text-2xl font-semibold">Your cart</h1>
      <Suspense fallback={<p>Loading your cart…</p>}>
        <LoadedCart />
      </Suspense>
    </main>
  );
}
