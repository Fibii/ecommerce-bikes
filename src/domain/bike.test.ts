import { bikeId } from "./bike";

describe("bikeId", () => {
  it("accepts a catalog id", () => {
    expect(bikeId("bike-001")).toEqual({ ok: true, value: "bike-001" });
  });

  it.each(["", " ", " bike-001", "bike 001"])("rejects %j", (value) => {
    expect(bikeId(value)).toEqual({
      ok: false,
      error: { code: "invalid-id", value },
    });
  });
});
