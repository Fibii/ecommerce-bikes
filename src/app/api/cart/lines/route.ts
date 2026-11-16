import { NextResponse, type NextRequest } from "next/server";
import { addLineRequest } from "@/contracts/api";
import { getApp } from "@/server/composition";
import {
  errorResponse,
  newCartId,
  readCartId,
  setCartCookie,
} from "@/server/http";

export async function POST(request: NextRequest) {
  const body = addLineRequest.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return errorResponse({
      code: "invalid-request",
      issues: body.error.issues,
    });
  }

  const id = readCartId(request) ?? newCartId();
  const added = await getApp().addToCart({ cartId: id, ...body.data });
  if (!added.ok) return errorResponse(added.error);

  return setCartCookie(NextResponse.json(added.value, { status: 201 }), id);
}
