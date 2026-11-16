import { NextResponse, type NextRequest } from "next/server";
import { getApp } from "@/server/composition";
import { newCartId, readCartId } from "@/server/http";

export async function DELETE(request: NextRequest) {
  const app = getApp();
  const id = readCartId(request);
  // A visitor without a cart has nothing to clear and gets no cookie.
  const cart =
    id === undefined ? await app.getCart(newCartId()) : await app.clearCart(id);
  return NextResponse.json(cart);
}
