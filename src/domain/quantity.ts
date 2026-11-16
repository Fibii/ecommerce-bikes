import type { Brand } from "./brand";
import { err, ok, type Result } from "./result";

/** A count of items: a whole number, zero or more. */
export type Quantity = Brand<number, "Quantity">;

export type InvalidQuantity = {
  readonly code: "invalid-quantity";
  readonly value: number;
};

export function quantity(value: number): Result<Quantity, InvalidQuantity> {
  return Number.isSafeInteger(value) && value >= 0
    ? ok(value as Quantity)
    : err({ code: "invalid-quantity", value });
}
