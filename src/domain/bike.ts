import type { Brand } from "./brand";
import type { FrameType } from "./frame-type";
import { isValidId, type InvalidId } from "./id";
import type { Cents, TaxRateBp } from "./money";
import { err, ok, type Result } from "./result";

export type BikeId = Brand<string, "BikeId">;

export type Bike = {
  readonly id: BikeId;
  readonly name: string;
  readonly frameType: FrameType;
  readonly netPrice: Cents;
  readonly taxRate: TaxRateBp;
};

export function bikeId(value: string): Result<BikeId, InvalidId> {
  return isValidId(value)
    ? ok(value as BikeId)
    : err({ code: "invalid-id", value });
}
