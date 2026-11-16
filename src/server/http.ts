import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import type { AddToCartError } from "@/application/cart";
import type { StockUnavailable } from "@/application/ports";
import { cartId, type CartId } from "@/domain/cart";
import {
  CART_COOKIE,
  CART_COOKIE_MAX_AGE_SECONDS,
  type ErrorCode,
  type ErrorResponse,
} from "@/contracts/api";

type ApiError =
  | AddToCartError
  | { readonly code: "line-not-found"; readonly lineId: string }
  | StockUnavailable
  | { readonly code: "cart-empty" }
  | { readonly code: "invalid-request"; readonly issues?: unknown };

const STATUS: Record<ErrorCode, number> = {
  "invalid-request": 400,
  "unknown-bike": 422,
  "unknown-accessory": 422,
  "incompatible-accessory": 422,
  "duplicate-accessory": 422,
  "quantity-out-of-range": 422,
  "line-not-found": 404,
  "cart-empty": 409,
  "stock-unavailable": 503,
};

/** The one place where a use case error becomes an HTTP response. */
export function errorResponse(error: ApiError): NextResponse<ErrorResponse> {
  const { code, ...details } = error;
  const status = STATUS[code];
  const headers: Record<string, string> =
    code === "stock-unavailable" ? { "Retry-After": "1" } : {};
  return NextResponse.json(
    {
      error: {
        code,
        message: code.replaceAll("-", " "),
        ...(Object.keys(details).length > 0 ? { details } : {}),
      },
    },
    { status, headers },
  );
}

/** The cart id of the request, if it carries a valid one. */
export function readCartId(request: NextRequest): CartId | undefined {
  const value = request.cookies.get(CART_COOKIE)?.value;
  if (value === undefined) return undefined;
  const parsed = cartId(value);
  return parsed.ok ? parsed.value : undefined;
}

export function newCartId(): CartId {
  const parsed = cartId(randomUUID());
  if (!parsed.ok) throw new Error("randomUUID made an invalid cart id");
  return parsed.value;
}

export function setCartCookie<T extends NextResponse>(
  response: T,
  id: CartId,
): T {
  response.cookies.set(CART_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: CART_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}
