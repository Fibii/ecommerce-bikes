import { InMemoryIdempotencyStore } from "./in-memory-idempotency-store";

const keepAll = () => true;

describe("InMemoryIdempotencyStore", () => {
  it("does the work once and returns the stored outcome for a repeated key", async () => {
    const store = new InMemoryIdempotencyStore();
    let runs = 0;
    const work = async () => ++runs;

    const first = await store.run("k", work, keepAll);
    const second = await store.run("k", work, keepAll);

    expect([first, second, runs]).toEqual([1, 1, 1]);
  });

  it("shares the result with a duplicate that arrives while the work runs", async () => {
    const store = new InMemoryIdempotencyStore();
    let runs = 0;
    let finish: (value: string) => void = () => {};
    const work = () => {
      runs++;
      return new Promise<string>((resolve) => (finish = resolve));
    };

    const first = store.run("k", work, keepAll);
    const duplicate = store.run("k", work, keepAll);
    finish("done");

    expect(await first).toBe("done");
    expect(await duplicate).toBe("done");
    expect(runs).toBe(1);
  });

  it("does the work again after an outcome that is not kept", async () => {
    const store = new InMemoryIdempotencyStore();
    let runs = 0;
    const work = async () => ++runs;

    await store.run("k", work, () => false);
    const second = await store.run("k", work, () => false);

    expect(second).toBe(2);
  });

  it("keeps different keys apart", async () => {
    const store = new InMemoryIdempotencyStore();

    const a = await store.run("a", async () => "A", keepAll);
    const b = await store.run("b", async () => "B", keepAll);

    expect([a, b]).toEqual(["A", "B"]);
  });

  it("forgets a key whose work threw, so a retry can succeed", async () => {
    const store = new InMemoryIdempotencyStore();

    await expect(
      store.run("k", async () => Promise.reject(new Error("boom")), keepAll),
    ).rejects.toThrow("boom");

    expect(await store.run("k", async () => "ok", keepAll)).toBe("ok");
  });
});
