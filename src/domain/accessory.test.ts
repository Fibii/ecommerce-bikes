import { accessoryId, isCompatible } from "./accessory";
import {
  aeroHandlebar,
  helmet,
  rearRack,
  rockriderTrail,
  speedlineCarbonRace,
  touringVoyager,
} from "./test-support";

describe("accessoryId", () => {
  it("accepts a catalog id", () => {
    expect(accessoryId("acc-001")).toEqual({ ok: true, value: "acc-001" });
  });

  it.each(["", "acc 001"])("rejects %j", (value) => {
    expect(accessoryId(value)).toEqual({
      ok: false,
      error: { code: "invalid-id", value },
    });
  });
});

describe("isCompatible", () => {
  it("is true when the accessory's frame types include the bike's", () => {
    // Aluminum Rear Rack fits Touring, Urban, E-Cargo and E-Urban frames.
    expect(isCompatible(rearRack, touringVoyager)).toBe(true);
  });

  it("is false when they do not", () => {
    expect(isCompatible(rearRack, speedlineCarbonRace)).toBe(false);
    expect(isCompatible(rearRack, rockriderTrail)).toBe(false);
  });

  it("is true for every bike when the accessory fits all frame types", () => {
    for (const bike of [touringVoyager, speedlineCarbonRace, rockriderTrail]) {
      expect(isCompatible(helmet, bike)).toBe(true);
    }
  });

  it("is true for one frame type only when the accessory names just that", () => {
    expect(isCompatible(aeroHandlebar, speedlineCarbonRace)).toBe(true);
    expect(isCompatible(aeroHandlebar, touringVoyager)).toBe(false);
  });
});
