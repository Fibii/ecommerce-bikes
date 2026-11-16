import { NextResponse, type NextRequest } from "next/server";
import { cartLineId } from "@/domain/cart";
import { getApp } from "@/server/composition";
import { errorResponse, readCartId } from "@/server/http";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ lineId: string }> },
) {
  const raw = (await params).lineId;
  const lineId = cartLineId(raw);
  const id = readCartId(request);
  if (!lineId.ok || id === undefined) {
    return errorResponse({ code: "line-not-found", lineId: raw });
  }

  const removed = await getApp().removeFromCart({
    cartId: id,
    lineId: lineId.value,
  });
  if (!removed.ok) return errorResponse(removed.error);
  return NextResponse.json(removed.value);
}
