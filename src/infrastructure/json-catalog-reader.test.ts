import path from "node:path";
import {
  JsonCatalogReader,
  priceToCents,
  rateToBp,
} from "./json-catalog-reader";

const DATA_DIR = path.join(process.cwd(), "data");

function readerOf(files: Record<string, unknown>) {
  return new JsonCatalogReader("/data", async (file) => {
    const content = files[path.basename(file)];
    if (content === undefined) throw new Error(`no such file: ${file}`);
    return typeof content === "string" ? content : JSON.stringify(content);
  });
}

const bike = {
  id: "bike-001",
  name: "Touring Voyager 5.0",
  frameType: "Touring",
  price: 899.0,
  taxRate: 0.19,
};
const accessory = {
  id: "acc-001",
  name: "Urban Pro Bike Helmet",
  price: 79.9,
  taxRate: 0.19,
  compatibleFrameTypes: ["Touring", "Road"],
  maxAmount: 4,
};

describe("JsonCatalogReader with the real catalog", () => {
  it("loads 10 bikes and 16 accessories", async () => {
    const catalog = await new JsonCatalogReader(DATA_DIR).read();

    expect(catalog.bikes).toHaveLength(10);
    expect(catalog.accessories).toHaveLength(16);
  });

  it("converts prices to cents and the tax rate to basis points", async () => {
    const catalog = await new JsonCatalogReader(DATA_DIR).read();

    expect(catalog.bikes[0]).toEqual({
      id: "bike-001",
      name: "Touring Voyager 5.0",
      frameType: "Touring",
      netPrice: 89900,
      taxRate: 1900,
    });
    // 79.9 * 100 is 7990.000000000001 in floating point.
    expect(catalog.accessories[0]).toMatchObject({
      id: "acc-001",
      netPrice: 7990,
      taxRate: 1900,
      maxAmount: 4,
    });
  });
});

describe("JsonCatalogReader with invalid data", () => {
  const read = (bikes: unknown, accessories: unknown = []) =>
    readerOf({ "bikes.json": bikes, "accessories.json": accessories }).read();

  it("accepts a valid catalog", async () => {
    const catalog = await read([bike], [accessory]);

    expect(catalog.bikes).toHaveLength(1);
    expect(catalog.accessories[0]?.compatibleFrameTypes).toEqual([
      "Touring",
      "Road",
    ]);
  });

  it.each([
    [
      "more than two decimals",
      { ...bike, price: 12.345 },
      "bike bike-001, price",
    ],
    ["a negative price", { ...bike, price: -1 }, "bike bike-001, price"],
    [
      "a price that is not a number",
      { ...bike, price: "899" },
      "bike bike-001, price",
    ],
    [
      "a tax rate that is not whole basis points",
      { ...bike, taxRate: 0.19005 },
      "bike bike-001, taxRate",
    ],
    [
      "an unknown frame type",
      { ...bike, frameType: "Gravel" },
      "bike bike-001, frameType",
    ],
    ["a missing name", { ...bike, name: "" }, "bike bike-001, name"],
  ])(
    "rejects a bike with %s, naming the product and field",
    async (_, bad, message) => {
      await expect(read([bad])).rejects.toThrow(message);
    },
  );

  it.each([
    [
      "no frame types",
      { ...accessory, compatibleFrameTypes: [] },
      "accessory acc-001, compatibleFrameTypes",
    ],
    [
      "a maxAmount that is not a whole number",
      { ...accessory, maxAmount: 1.5 },
      "accessory acc-001, maxAmount",
    ],
    [
      "a missing maxAmount",
      { ...accessory, maxAmount: undefined },
      "accessory acc-001, maxAmount",
    ],
  ])(
    "rejects an accessory with %s, naming the product and field",
    async (_, bad, message) => {
      await expect(read([bike], [bad])).rejects.toThrow(message);
    },
  );

  it("rejects a file that is not valid JSON", async () => {
    await expect(read("{", [])).rejects.toThrow("bikes.json is not valid JSON");
  });

  it("rejects a file that does not hold a list", async () => {
    await expect(read({ bikes: [] })).rejects.toThrow(
      "bikes.json must hold a list",
    );
  });
});

describe("priceToCents", () => {
  it.each([
    [899, 89900],
    [79.9, 7990],
    [34.95, 3495],
    [0, 0],
  ])("converts %d to %d cents", (price, expected) => {
    expect(priceToCents(price)).toEqual({ ok: true, value: expected });
  });

  it.each([12.345, -0.01, Number.NaN, Number.POSITIVE_INFINITY, "1"])(
    "rejects %p",
    (price) => {
      expect(priceToCents(price).ok).toBe(false);
    },
  );
});

describe("rateToBp", () => {
  it("converts 0.19 to 1900", () => {
    expect(rateToBp(0.19)).toEqual({ ok: true, value: 1900 });
  });

  it.each([0.19005, -0.1, 1.5, Number.NaN])("rejects %p", (rate) => {
    expect(rateToBp(rate).ok).toBe(false);
  });
});
