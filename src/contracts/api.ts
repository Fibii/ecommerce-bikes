import { z } from "zod";
import { FRAME_TYPES } from "@/domain/frame-type";

/** Name of the cookie that identifies a visitor's cart. Lives 7 days. */
export const CART_COOKIE = "cart_id";
export const CART_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
export const IDEMPOTENCY_HEADER = "Idempotency-Key";

/** Ids hold at least one character and no whitespace, as in the domain. */
const id = z.string().regex(/^\S+$/);

// ---- Requests: no price ever appears in one ----

export const addLineRequest = z.object({
  bikeId: id,
  accessories: z.array(
    z.object({ accessoryId: id, quantity: z.number().int() }),
  ),
});
export type AddLineRequest = z.infer<typeof addLineRequest>;

/** `?ids=a,b,c`: at least one product id, each at most once. */
export const availabilityQuery = z
  .string()
  .transform((raw) => raw.split(","))
  .pipe(z.array(id).min(1).max(100));

export const idempotencyKey = z.string().trim().min(1).max(200);

// ---- Responses ----

const cents = z.number().int();
const price = z.object({ net: cents, tax: cents, gross: cents });
const frameType = z.enum(FRAME_TYPES);

export const cartViewResponse = z.object({
  id: z.string(),
  lines: z.array(
    z.object({
      id: z.string(),
      bike: z.object({
        id: z.string(),
        name: z.string(),
        frameType,
        netPrice: cents,
        taxRate: z.number(),
      }),
      accessories: z.array(
        z.object({
          accessory: z.object({
            id: z.string(),
            name: z.string(),
            netPrice: cents,
            taxRate: z.number(),
            compatibleFrameTypes: z.array(frameType),
            maxAmount: z.number().int(),
          }),
          quantity: z.number().int(),
        }),
      ),
      price,
    }),
  ),
  totals: price,
});
export type CartViewResponse = z.infer<typeof cartViewResponse>;

export const availabilityResponse = z.object({
  items: z.array(
    z.object({ productId: z.string(), available: z.number().int() }),
  ),
});

/** The answers of `POST /api/checkout`. Errors other than these use the envelope. */
export const checkoutResponse = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("confirmed"),
    orderId: z.string(),
    totals: price,
  }),
  z.object({
    status: z.literal("shortfall"),
    items: z.array(
      z.object({
        productId: z.string(),
        requested: z.number().int(),
        available: z.number().int(),
      }),
    ),
  }),
  z.object({ status: z.literal("stock-unavailable") }),
]);
export type CheckoutResponse = z.infer<typeof checkoutResponse>;

// ---- The one error envelope ----

/** Closed union: the UI switches on `code`, never on the message. */
export const ERROR_CODES = [
  "invalid-request",
  "unknown-bike",
  "unknown-accessory",
  "incompatible-accessory",
  "duplicate-accessory",
  "quantity-out-of-range",
  "line-not-found",
  "cart-empty",
  "stock-unavailable",
  "unauthorized",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const errorResponse = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponse>;
