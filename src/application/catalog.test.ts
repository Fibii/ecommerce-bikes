import { fakeCatalog } from "./test-support";
import { getCatalog, getCompatibleAccessories } from "./catalog";

const deps = { catalog: fakeCatalog() };

describe("getCatalog", () => {
  it("returns every bike and accessory", async () => {
    const catalog = await getCatalog(deps);

    expect(catalog.bikes.map((bike) => bike.id)).toEqual([
      "bike-001",
      "bike-003",
      "bike-005",
    ]);
    expect(catalog.accessories).toHaveLength(11);
  });
});

describe("getCompatibleAccessories", () => {
  it("returns only the accessories whose frame types include the bike's", async () => {
    const result = await getCompatibleAccessories(deps, "bike-003");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.value.map((accessory) => accessory.id);
    expect(ids).toContain("acc-011"); // aero handlebar fits Road
    expect(ids).not.toContain("acc-007"); // rear rack does not
  });

  it("reports an unknown bike", async () => {
    const result = await getCompatibleAccessories(deps, "bike-999");

    expect(result).toEqual({
      ok: false,
      error: { code: "unknown-bike", bikeId: "bike-999" },
    });
  });
});
