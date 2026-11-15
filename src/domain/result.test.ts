import { err, ok, type Result } from "./result";

function half(n: number): Result<number, { code: "odd"; value: number }> {
  return n % 2 === 0 ? ok(n / 2) : err({ code: "odd", value: n });
}

describe("Result", () => {
  it("carries the value of a success", () => {
    const result = half(10);

    expect(result.ok).toBe(true);
    expect(result).toEqual({ ok: true, value: 5 });
  });

  it("carries the typed error of an expected failure", () => {
    const result = half(7);

    expect(result.ok).toBe(false);
    expect(result).toEqual({ ok: false, error: { code: "odd", value: 7 } });
  });

  it("is plain data that survives serialisation", () => {
    expect(JSON.parse(JSON.stringify(half(10)))).toEqual(half(10));
  });
});
