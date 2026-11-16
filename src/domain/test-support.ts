import { accessoryId, type Accessory } from "./accessory";
import { bikeId, type Bike } from "./bike";
import { FRAME_TYPES, type FrameType } from "./frame-type";
import { cents, taxRateBp } from "./money";
import { quantity } from "./quantity";
import type { Result } from "./result";

/**
 * Test helper: the value of a result that the test expects to succeed.
 * Throws otherwise, which fails the test with the typed error in the message.
 */
export function must<T>(result: Result<T, unknown>): T {
  if (!result.ok) {
    throw new Error(`Expected ok, got ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

// Fixtures: products from the real catalog in data/, with prices in cents.

const VAT_19 = must(taxRateBp(1900));

const ALL_FRAME_TYPES: readonly FrameType[] = FRAME_TYPES;

function bike(
  id: string,
  name: string,
  frameType: FrameType,
  netPrice: number,
): Bike {
  return {
    id: must(bikeId(id)),
    name,
    frameType,
    netPrice: must(cents(netPrice)),
    taxRate: VAT_19,
  };
}

function accessory(
  id: string,
  name: string,
  netPrice: number,
  compatibleFrameTypes: readonly FrameType[],
  maxAmount: number,
): Accessory {
  return {
    id: must(accessoryId(id)),
    name,
    netPrice: must(cents(netPrice)),
    taxRate: VAT_19,
    compatibleFrameTypes,
    maxAmount: must(quantity(maxAmount)),
  };
}

export const touringVoyager = bike(
  "bike-001",
  "Touring Voyager 5.0",
  "Touring",
  89900,
);
export const speedlineCarbonRace = bike(
  "bike-003",
  "Speedline Carbon Race",
  "Road",
  239900,
);
export const rockriderTrail = bike(
  "bike-005",
  "Rockrider Trail 29",
  "Mountain",
  109900,
);

export const helmet = accessory(
  "acc-001",
  "Urban Pro Bike Helmet",
  7990,
  ALL_FRAME_TYPES,
  4,
);
export const chainLock = accessory(
  "acc-002",
  "SecureLock Chain Lock 12mm",
  5450,
  ALL_FRAME_TYPES,
  2,
);
export const lightSet = accessory(
  "acc-003",
  "LED Light Set Front & Rear",
  3495,
  ALL_FRAME_TYPES,
  2,
);
export const bikeComputer = accessory(
  "acc-004",
  "GPS Bike Computer Basic",
  8900,
  ALL_FRAME_TYPES,
  1,
);
export const bottleCage = accessory(
  "acc-005",
  "Aluminum Bottle Cage",
  1290,
  ALL_FRAME_TYPES,
  2,
);
export const repairKit = accessory(
  "acc-006",
  "Compact Puncture Repair Kit",
  1650,
  ALL_FRAME_TYPES,
  3,
);
export const rearRack = accessory(
  "acc-007",
  "Aluminum Rear Rack",
  4400,
  ["Touring", "Urban", "E-Cargo", "E-Urban"],
  1,
);
export const fenderSet = accessory(
  "acc-008",
  "All-Weather Fender Set",
  2990,
  ["Touring", "Urban", "E-Urban"],
  1,
);
export const childSeat = accessory(
  "acc-009",
  "FamilyRide Child Seat",
  11900,
  ["Touring", "Urban", "E-Cargo", "E-Urban"],
  2,
);
export const childTrailer = accessory(
  "acc-010",
  "DuoComfort Child Trailer",
  34900,
  ["Touring", "Urban", "E-Cargo"],
  1,
);
export const aeroHandlebar = accessory(
  "acc-011",
  "Carbon Aero Handlebar Extension",
  12900,
  ["Road"],
  1,
);
