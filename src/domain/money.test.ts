import {
  cents,
  priceOf,
  sumCents,
  sumPrices,
  taxOf,
  taxRateBp,
  times,
} from "./money";
import { quantity } from "./quantity";
import { must } from "./test-support";

const c = (value: number) => must(cents(value));
const VAT_19 = must(taxRateBp(1900));
// The catalog has a single rate, 19 %. This second rate is made up.
const VAT_7 = must(taxRateBp(700));

describe("cents", () => {
  it.each([0, 1650, 89900])("accepts %d whole cents", (value) => {
    expect(cents(value)).toEqual({ ok: true, value });
  });

  it.each([
    -1,
    16.5,
    79.9 * 100, // 7990.000000000001: a float price must not enter the domain
    Number.NaN,
    Number.POSITIVE_INFINITY,
    2 ** 53,
  ])("rejects %d", (value) => {
    expect(cents(value)).toEqual({
      ok: false,
      error: { code: "invalid-cents", value },
    });
  });
});

describe("taxRateBp", () => {
  it.each([0, 700, 1900, 10000])("accepts %d basis points", (value) => {
    expect(taxRateBp(value)).toEqual({ ok: true, value });
  });

  it.each([-1, 0.19, 1900.5, 10001, Number.NaN])("rejects %d", (value) => {
    expect(taxRateBp(value)).toEqual({
      ok: false,
      error: { code: "invalid-tax-rate", value },
    });
  });
});

describe("taxOf", () => {
  it.each([
    // acc-006 Compact Puncture Repair Kit: 313.5 rounds up. Floats give 313.
    { net: 1650, tax: 314 },
    // acc-014 Suspension Fork Service Kit: 750.5 rounds up. Floats give 750.
    { net: 3950, tax: 751 },
    // A further half-cent case: 9.5 rounds up.
    { net: 50, tax: 10 },
    { net: 0, tax: 0 },
  ])("is $tax cents on $net cents net at 19 %", ({ net, tax }) => {
    expect(taxOf(c(net), VAT_19)).toBe(tax);
  });

  it("is rounded once per rate on a line with two rates", () => {
    // 1650 at 19 % is 313.5 and 50 at 7 % is 3.5. Each rate rounds up on its
    // own: 314 + 4. Rounding the line's 317.0 once would lose a cent.
    expect(taxOf(c(1650), VAT_19) + taxOf(c(50), VAT_7)).toBe(318);
  });

  it("is zero at a rate of 0 %", () => {
    expect(taxOf(c(89900), must(taxRateBp(0)))).toBe(0);
  });
});

describe("priceOf", () => {
  it("gives net, tax and gross, with gross = net + tax", () => {
    // A14: the gross of 16.50 at 19 % is 19.64.
    expect(priceOf([{ net: c(1650), taxRate: VAT_19 }])).toEqual({
      net: 1650,
      tax: 314,
      gross: 1964,
    });
  });

  it("rounds once on the summed net, not once per amount", () => {
    // Two repair kits: 3300 net is exactly 627 tax. Per unit it would be 628.
    expect(
      priceOf([
        { net: c(1650), taxRate: VAT_19 },
        { net: c(1650), taxRate: VAT_19 },
      ]),
    ).toEqual({ net: 3300, tax: 627, gross: 3927 });
  });

  it("rounds once per rate when the amounts mix rates", () => {
    expect(
      priceOf([
        { net: c(1650), taxRate: VAT_19 },
        { net: c(50), taxRate: VAT_7 },
        { net: c(1650), taxRate: VAT_19 },
      ]),
    ).toEqual({ net: 3350, tax: 627 + 4, gross: 3981 });
  });

  it("is zero for no amounts", () => {
    expect(priceOf([])).toEqual({ net: 0, tax: 0, gross: 0 });
  });
});

describe("sumPrices", () => {
  it("adds prices without rounding again", () => {
    const repairKit = priceOf([{ net: c(1650), taxRate: VAT_19 }]);

    // Two separately priced lines keep their own rounding: 314 + 314.
    expect(sumPrices([repairKit, repairKit])).toEqual({
      net: 3300,
      tax: 628,
      gross: 3928,
    });
  });

  it("is zero for no prices", () => {
    expect(sumPrices([])).toEqual({ net: 0, tax: 0, gross: 0 });
  });
});

describe("cents arithmetic", () => {
  it("sums amounts", () => {
    expect(sumCents([c(89900), c(7990), c(5450)])).toBe(103340);
    expect(sumCents([])).toBe(0);
  });

  it("multiplies an amount by a quantity", () => {
    // Four Urban Pro Bike Helmets at 79.90.
    expect(times(c(7990), must(quantity(4)))).toBe(31960);
    expect(times(c(7990), must(quantity(0)))).toBe(0);
  });
});
