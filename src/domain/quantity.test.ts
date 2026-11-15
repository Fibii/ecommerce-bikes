import { quantity } from "./quantity";

describe("quantity", () => {
  it.each([0, 1, 4])("accepts the whole number %d", (value) => {
    expect(quantity(value)).toEqual({ ok: true, value });
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53])(
    "rejects %d",
    (value) => {
      expect(quantity(value)).toEqual({
        ok: false,
        error: { code: "invalid-quantity", value },
      });
    },
  );
});
