import { NextResponse, type NextRequest } from "next/server";
import { IDEMPOTENCY_HEADER, idempotencyKey } from "@/contracts/api";
import { getApp } from "@/server/composition";
import { errorResponse, readCartId } from "@/server/http";

export async function POST(request: NextRequest) {
  const key = idempotencyKey.safeParse(request.headers.get(IDEMPOTENCY_HEADER));
  if (!key.success) {
    return errorResponse({
      code: "invalid-request",
      issues: key.error.issues,
    });
  }

  const id = readCartId(request);
  if (id === undefined) return errorResponse({ code: "cart-empty" });

  const result = await getApp().checkout({
    cartId: id,
    idempotencyKey: key.data,
  });
  switch (result.status) {
    case "confirmed":
      return NextResponse.json(result);
    case "cart-empty":
      return errorResponse({ code: "cart-empty" });
    case "shortfall":
      return NextResponse.json(result, { status: 409 });
    case "stock-unavailable":
      return NextResponse.json(result, {
        status: 503,
        headers: { "Retry-After": "1" },
      });
  }
}
