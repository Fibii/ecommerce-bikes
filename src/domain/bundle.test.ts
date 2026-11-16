import type { Accessory } from "./accessory";
import { createBundle, priceBundle } from "./bundle";
import { cents, taxRateBp } from "./money";
import { quantity } from "./quantity";
import {
  aeroHandlebar,
  bikeComputer,
  bottleCage,
  chainLock,
  childSeat,
  childTrailer,
  fenderSet,
  helmet,
  lightSet,
  must,
  rearRack,
  repairKit,
  speedlineCarbonRace,
  touringVoyager,
} from "./test-support";

const select = (accessory: Accessory, amount: number) => ({
  accessory,
  quantity: must(quantity(amount)),
});

describe("createBundle", () => {
  it("is one bike plus the chosen accessory quantities", () => {
    const result = createBundle(touringVoyager, [
      select(helmet, 2),
      select(rearRack, 1),
    ]);

    expect(result).toEqual({
      ok: true,
      value: {
        bike: touringVoyager,
        accessories: [
          { accessory: helmet, quantity: 2 },
          { accessory: rearRack, quantity: 1 },
        ],
      },
    });
  });

  it("can be a bike with no accessories", () => {
    expect(createBundle(touringVoyager, [])).toEqual({
      ok: true,
      value: { bike: touringVoyager, accessories: [] },
    });
  });

  it("accepts a quantity equal to the accessory's maxAmount", () => {
    const result = createBundle(touringVoyager, [select(helmet, 4)]);

    expect(result.ok).toBe(true);
  });

  it("rejects a quantity above the accessory's maxAmount", () => {
    expect(createBundle(touringVoyager, [select(helmet, 5)])).toEqual({
      ok: false,
      error: {
        code: "quantity-out-of-range",
        accessoryId: "acc-001",
        quantity: 5,
        maxAmount: 4,
      },
    });
  });

  it("rejects an accessory that is not compatible with the bike", () => {
    // Carbon Aero Handlebar Extension fits Road frames only.
    expect(createBundle(touringVoyager, [select(aeroHandlebar, 1)])).toEqual({
      ok: false,
      error: {
        code: "incompatible-accessory",
        accessoryId: "acc-011",
        frameType: "Touring",
      },
    });
    expect(
      createBundle(speedlineCarbonRace, [select(aeroHandlebar, 1)]).ok,
    ).toBe(true);
  });

  it("leaves out an accessory with quantity 0", () => {
    const result = createBundle(touringVoyager, [
      select(helmet, 0),
      select(chainLock, 1),
      select(aeroHandlebar, 0),
    ]);

    expect(must(result).accessories).toEqual([
      { accessory: chainLock, quantity: 1 },
    ]);
  });

  it("rejects an accessory listed twice", () => {
    const result = createBundle(touringVoyager, [
      select(helmet, 1),
      select(chainLock, 1),
      select(helmet, 2),
    ]);

    expect(result).toEqual({
      ok: false,
      error: { code: "duplicate-accessory", accessoryId: "acc-001" },
    });
  });

  it("rejects an accessory listed twice even when one quantity is 0", () => {
    const result = createBundle(touringVoyager, [
      select(helmet, 0),
      select(helmet, 1),
    ]);

    expect(result).toEqual({
      ok: false,
      error: { code: "duplicate-accessory", accessoryId: "acc-001" },
    });
  });
});

describe("priceBundle", () => {
  it("is the bike's price for a bike alone", () => {
    const bundle = must(createBundle(touringVoyager, []));

    // 899.00 net at 19 %.
    expect(priceBundle(bundle)).toEqual({
      net: 89900,
      tax: 17081,
      gross: 106981,
    });
  });

  it("sums the net of the bike and every accessory times its quantity", () => {
    // The bundle from the decision record: Touring Voyager 5.0 with two
    // helmets, a chain lock, a rear rack and three repair kits.
    const bundle = must(
      createBundle(touringVoyager, [
        select(helmet, 2),
        select(chainLock, 1),
        select(rearRack, 1),
        select(repairKit, 3),
      ]),
    );

    expect(priceBundle(bundle)).toEqual({
      net: 120680,
      tax: 22929,
      gross: 143609,
    });
  });

  it("rounds tax once for the line, not once per unit", () => {
    // The largest Touring Voyager 5.0 bundle: every compatible accessory at
    // its maxAmount. Rounding per unit would give a gross of 2,645.03.
    const bundle = must(
      createBundle(touringVoyager, [
        select(helmet, 4),
        select(chainLock, 2),
        select(lightSet, 2),
        select(bikeComputer, 1),
        select(bottleCage, 2),
        select(repairKit, 3),
        select(rearRack, 1),
        select(fenderSet, 1),
        select(childSeat, 2),
        select(childTrailer, 1),
      ]),
    );

    expect(priceBundle(bundle)).toEqual({
      net: 222270,
      tax: 42231,
      gross: 264501,
    });
  });

  it("rounds tax once per rate when a line mixes rates", () => {
    // The catalog has a single rate, so this 7 % accessory is made up.
    const reducedRateItem: Accessory = {
      ...bottleCage,
      netPrice: must(cents(50)),
      taxRate: must(taxRateBp(700)),
    };
    const bikeAt1650: typeof touringVoyager = {
      ...touringVoyager,
      netPrice: must(cents(1650)),
    };
    const bundle = must(createBundle(bikeAt1650, [select(reducedRateItem, 1)]));

    // 19 % of 1650 is 313.5 and 7 % of 50 is 3.5: 314 + 4, not round(317.0).
    expect(priceBundle(bundle)).toEqual({ net: 1700, tax: 318, gross: 2018 });
  });
});
