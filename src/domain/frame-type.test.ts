import { FRAME_TYPES, frameType } from "./frame-type";

describe("frameType", () => {
  it.each(["Touring", "Road", "Mountain", "Urban", "E-Cargo", "E-Urban"])(
    "accepts the catalog frame type %s",
    (value) => {
      expect(frameType(value)).toEqual({ ok: true, value });
    },
  );

  it.each(["Gravel", "touring", ""])("rejects %j", (value) => {
    expect(frameType(value)).toEqual({
      ok: false,
      error: { code: "unknown-frame-type", value },
    });
  });

  it("lists every frame type once", () => {
    expect(new Set(FRAME_TYPES).size).toBe(6);
  });
});
