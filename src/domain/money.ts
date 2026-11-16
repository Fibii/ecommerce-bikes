import type { Brand } from "./brand";
import type { Quantity } from "./quantity";
import { err, ok, type Result } from "./result";

/** An amount of money in whole cents, zero or more. */
export type Cents = Brand<number, "Cents">;

/** A tax rate in basis points: 1900 is 19 %. */
export type TaxRateBp = Brand<number, "TaxRateBp">;

export type InvalidCents = {
  readonly code: "invalid-cents";
  readonly value: number;
};

export type InvalidTaxRate = {
  readonly code: "invalid-tax-rate";
  readonly value: number;
};

/** What a customer pays: gross = net + tax. */
export type Price = {
  readonly net: Cents;
  readonly tax: Cents;
  readonly gross: Cents;
};

/** A net amount together with the tax rate that applies to it. */
export type TaxedAmount = {
  readonly net: Cents;
  readonly taxRate: TaxRateBp;
};

const BASIS_POINTS = 10000;
const ZERO = 0 as Cents;

export function cents(value: number): Result<Cents, InvalidCents> {
  return Number.isSafeInteger(value) && value >= 0
    ? ok(value as Cents)
    : err({ code: "invalid-cents", value });
}

export function taxRateBp(value: number): Result<TaxRateBp, InvalidTaxRate> {
  return Number.isInteger(value) && value >= 0 && value <= BASIS_POINTS
    ? ok(value as TaxRateBp)
    : err({ code: "invalid-tax-rate", value });
}

export function sumCents(amounts: readonly Cents[]): Cents {
  return amounts.reduce((total, amount) => total + amount, 0) as Cents;
}

export function times(amount: Cents, quantity: Quantity): Cents {
  return (amount * quantity) as Cents;
}

/**
 * The tax on a net amount, rounded half-up to a whole cent with integer
 * arithmetic. This is the only place tax is computed.
 *
 * Half-up through `floor` is correct only for amounts that are not negative.
 * `Cents` cannot be negative, and refunds are out of scope.
 */
export function taxOf(net: Cents, rate: TaxRateBp): Cents {
  return Math.floor((net * rate + BASIS_POINTS / 2) / BASIS_POINTS) as Cents;
}

/**
 * The price of amounts that are sold together, such as one cart line.
 * Tax is rounded once per tax rate, on the summed net of that rate.
 */
export function priceOf(amounts: readonly TaxedAmount[]): Price {
  const netByRate = new Map<TaxRateBp, Cents>();
  for (const { net, taxRate } of amounts) {
    netByRate.set(taxRate, sumCents([netByRate.get(taxRate) ?? ZERO, net]));
  }

  const net = sumCents([...netByRate.values()]);
  const tax = sumCents(
    [...netByRate].map(([rate, rateNet]) => taxOf(rateNet, rate)),
  );
  return { net, tax, gross: sumCents([net, tax]) };
}

/** Adds prices as they are. Sums of rounded values are never rounded again. */
export function sumPrices(prices: readonly Price[]): Price {
  return {
    net: sumCents(prices.map((price) => price.net)),
    tax: sumCents(prices.map((price) => price.tax)),
    gross: sumCents(prices.map((price) => price.gross)),
  };
}
