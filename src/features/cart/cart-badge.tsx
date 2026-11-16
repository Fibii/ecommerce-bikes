import Link from "next/link";
import { cookies } from "next/headers";
import { CART_COOKIE } from "@/contracts/api";
import { cartId } from "@/domain/cart";
import { getApp } from "@/server/composition";

/** The number of bundles in the visitor's cart, rendered on the server. */
export async function CartBadge() {
  const value = (await cookies()).get(CART_COOKIE)?.value;
  const id = value === undefined ? undefined : cartId(value);
  const count = id?.ok ? (await getApp().getCart(id.value)).lines.length : 0;
  return (
    <Link href="/cart" className="text-sm font-medium hover:underline">
      Cart
      <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-on-primary">
        {count}
        <span className="sr-only"> {count === 1 ? "bundle" : "bundles"}</span>
      </span>
    </Link>
  );
}
