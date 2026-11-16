import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Catalog, CatalogReader } from "@/application/ports";
import { accessoryId, type Accessory } from "@/domain/accessory";
import { bikeId, type Bike } from "@/domain/bike";
import { frameType } from "@/domain/frame-type";
import { cents, taxRateBp, type Cents, type TaxRateBp } from "@/domain/money";
import { quantity } from "@/domain/quantity";
import type { Result } from "@/domain/result";

type ReadText = (file: string) => Promise<string>;

/**
 * Reads `bikes.json` and `accessories.json` from a folder and turns them into
 * domain data: prices in integer cents, tax rates in basis points.
 *
 * Loading fails, with a message that names the product and the field, if the
 * data is not valid. A broken catalog is a bug in the data, not an expected
 * failure, so the reader throws.
 */
export class JsonCatalogReader implements CatalogReader {
  constructor(
    private readonly dataDir: string,
    private readonly readText: ReadText = (file) => readFile(file, "utf8"),
  ) {}

  async read(): Promise<Catalog> {
    const [bikes, accessories] = await Promise.all([
      this.readJson("bikes.json"),
      this.readJson("accessories.json"),
    ]);
    return {
      bikes: asList(bikes, "bikes.json").map(toBike),
      accessories: asList(accessories, "accessories.json").map(toAccessory),
    };
  }

  private async readJson(name: string): Promise<unknown> {
    const text = await this.readText(path.join(this.dataDir, name));
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`${name} is not valid JSON`);
    }
  }
}

/**
 * Converts a decimal price such as 79.9 to whole cents. Rejects a value that
 * is not finite, is negative or has more than two decimals, instead of
 * rounding it unnoticed. The raw float never reaches the domain.
 */
export function priceToCents(price: unknown): Result<Cents, string> {
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
    return { ok: false, error: "must be a finite number, 0 or more" };
  }
  const wholeCents = Math.round(price * 100);
  if (Math.abs(price * 100 - wholeCents) >= 1e-6) {
    return { ok: false, error: "must have at most two decimals" };
  }
  return domain(cents(wholeCents));
}

/** Converts a rate such as 0.19 to whole basis points (1900). */
export function rateToBp(rate: unknown): Result<TaxRateBp, string> {
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate < 0) {
    return { ok: false, error: "must be a finite number, 0 or more" };
  }
  const bp = Math.round(rate * 10000);
  if (Math.abs(rate * 10000 - bp) >= 1e-6) {
    return { ok: false, error: "must be a whole number of basis points" };
  }
  return domain(taxRateBp(bp));
}

function domain<T>(
  result: Result<T, { readonly code: string }>,
): Result<T, string> {
  return result.ok
    ? result
    : { ok: false, error: `is invalid (${result.error.code})` };
}

function asList(value: unknown, file: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${file} must hold a list`);
  return value;
}

function field(
  entry: unknown,
  name: string,
  label: (name: string) => string,
): unknown {
  if (typeof entry !== "object" || entry === null) {
    throw new Error(`${label(name)}: the entry is not an object`);
  }
  return (entry as Record<string, unknown>)[name];
}

function valid<T>(
  result: Result<T, string | { readonly code: string }>,
  label: string,
): T {
  if (result.ok) return result.value;
  const reason =
    typeof result.error === "string" ? result.error : result.error.code;
  throw new Error(`${label} ${reason}`);
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function toBike(entry: unknown): Bike {
  const id = text(
    field(entry, "id", (n) => n),
    "a bike's id",
  );
  const label = (name: string) => `bike ${id}, ${name}`;
  const get = (name: string) => field(entry, name, label);
  return {
    id: valid(bikeId(id), label("id")),
    name: text(get("name"), label("name")),
    frameType: valid(
      frameType(text(get("frameType"), label("frameType"))),
      label("frameType"),
    ),
    netPrice: valid(priceToCents(get("price")), label("price")),
    taxRate: valid(rateToBp(get("taxRate")), label("taxRate")),
  };
}

function toAccessory(entry: unknown): Accessory {
  const id = text(
    field(entry, "id", (n) => n),
    "an accessory's id",
  );
  const label = (name: string) => `accessory ${id}, ${name}`;
  const get = (name: string) => field(entry, name, label);
  const frameTypes = get("compatibleFrameTypes");
  if (!Array.isArray(frameTypes) || frameTypes.length === 0) {
    throw new Error(
      `${label("compatibleFrameTypes")} must be a non-empty list`,
    );
  }
  const max = get("maxAmount");
  return {
    id: valid(accessoryId(id), label("id")),
    name: text(get("name"), label("name")),
    netPrice: valid(priceToCents(get("price")), label("price")),
    taxRate: valid(rateToBp(get("taxRate")), label("taxRate")),
    compatibleFrameTypes: frameTypes.map((value) =>
      valid(
        frameType(text(value, label("compatibleFrameTypes"))),
        label("compatibleFrameTypes"),
      ),
    ),
    maxAmount: valid(
      quantity(typeof max === "number" ? max : Number.NaN),
      label("maxAmount"),
    ),
  };
}
