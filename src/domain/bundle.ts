import { isCompatible, type Accessory, type AccessoryId } from "./accessory";
import type { Bike } from "./bike";
import type { Brand } from "./brand";
import type { FrameType } from "./frame-type";
import { priceOf, times, type Price } from "./money";
import type { Quantity } from "./quantity";
import { err, ok, type Result } from "./result";

/** An accessory and how many of it. */
export type AccessoryQuantity = {
  readonly accessory: Accessory;
  readonly quantity: Quantity;
};

type BundleContents = {
  readonly bike: Bike;
  readonly accessories: readonly AccessoryQuantity[];
};

/**
 * One bike plus the accessories chosen for it. Every accessory in a bundle is
 * compatible with the bike and has a quantity from 1 to its maxAmount.
 * Only `createBundle` makes one.
 */
export type Bundle = Brand<BundleContents, "Bundle">;

export type IncompatibleAccessory = {
  readonly code: "incompatible-accessory";
  readonly accessoryId: AccessoryId;
  readonly frameType: FrameType;
};

export type QuantityOutOfRange = {
  readonly code: "quantity-out-of-range";
  readonly accessoryId: AccessoryId;
  readonly quantity: number;
  readonly maxAmount: Quantity;
};

export type DuplicateAccessory = {
  readonly code: "duplicate-accessory";
  readonly accessoryId: AccessoryId;
};

export type BundleError =
  | IncompatibleAccessory
  | QuantityOutOfRange
  | DuplicateAccessory;

/**
 * Builds a bundle from a bike and accessory quantities (0..maxAmount).
 *
 * A quantity of 0 means the accessory is not in the bundle. An accessory
 * listed more than once is rejected.
 * The first accessory that breaks a rule is returned as the error.
 */
export function createBundle(
  bike: Bike,
  selection: readonly AccessoryQuantity[],
): Result<Bundle, BundleError> {
  const seen = new Set<AccessoryId>();
  const accessories: AccessoryQuantity[] = [];
  for (const { accessory, quantity } of selection) {
    if (seen.has(accessory.id)) {
      return err({ code: "duplicate-accessory", accessoryId: accessory.id });
    }
    seen.add(accessory.id);
    if (quantity === 0) continue;
    if (!isCompatible(accessory, bike)) {
      return err({
        code: "incompatible-accessory",
        accessoryId: accessory.id,
        frameType: bike.frameType,
      });
    }
    if (quantity > accessory.maxAmount) {
      return err({
        code: "quantity-out-of-range",
        accessoryId: accessory.id,
        quantity,
        maxAmount: accessory.maxAmount,
      });
    }
    accessories.push({ accessory, quantity });
  }

  const bundle: BundleContents = { bike, accessories };
  return ok(bundle as Bundle);
}

/**
 * Net, tax and gross of a bundle, priced as one line: the net of the bike and
 * of every accessory times its quantity, with tax rounded once per tax rate.
 */
export function priceBundle(bundle: Bundle): Price {
  return priceOf([
    { net: bundle.bike.netPrice, taxRate: bundle.bike.taxRate },
    ...bundle.accessories.map(({ accessory, quantity }) => ({
      net: times(accessory.netPrice, quantity),
      taxRate: accessory.taxRate,
    })),
  ]);
}
