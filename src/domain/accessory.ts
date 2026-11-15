import type { Bike } from "./bike";
import type { Brand } from "./brand";
import type { FrameType } from "./frame-type";
import { isValidId, type InvalidId } from "./id";
import type { Cents, TaxRateBp } from "./money";
import type { Quantity } from "./quantity";
import { err, ok, type Result } from "./result";

export type AccessoryId = Brand<string, "AccessoryId">;

export type Accessory = {
  readonly id: AccessoryId;
  readonly name: string;
  readonly netPrice: Cents;
  readonly taxRate: TaxRateBp;
  readonly compatibleFrameTypes: readonly FrameType[];
  /** The most of this accessory that one bundle may hold. */
  readonly maxAmount: Quantity;
};

export function accessoryId(value: string): Result<AccessoryId, InvalidId> {
  return isValidId(value)
    ? ok(value as AccessoryId)
    : err({ code: "invalid-id", value });
}

/** An accessory is compatible if its frame types include the bike's. */
export function isCompatible(accessory: Accessory, bike: Bike): boolean {
  return accessory.compatibleFrameTypes.includes(bike.frameType);
}
