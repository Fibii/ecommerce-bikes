/** @jest-environment node */
import { NextRequest } from "next/server";
import type { StockService } from "@/application/ports";
import { err, ok } from "@/domain/result";
import { createAdapters, createApp } from "@/server/composition";
import { DELETE as clearCart } from "./cart/route";
import { POST as addLine } from "./cart/lines/route";
import { DELETE as removeLine } from "./cart/lines/[lineId]/route";
import { GET as availability } from "./availability/route";
import { POST as checkout } from "./checkout/route";

const ENV = {
  STOCK_FAILURE_RATE: "0",
  STOCK_LATENCY_MIN_MS: "0",
  STOCK_LATENCY_MAX_MS: "0",
};

const globals = globalThis as { __bikesApp?: unknown };

function installStock(override: Partial<StockService> = {}) {
  const adapters = createAdapters(ENV);
  const real = adapters.stock;
  const stock: StockService = {
    availability: (ids) => real.availability(ids),
    reserve: (items) => real.reserve(items),
    ...override,
  };
  globals.__bikesApp = createApp({ ...adapters, stock });
}

beforeEach(() => installStock());
afterAll(() => delete globals.__bikesApp);

function call(
  method: string,
  path: string,
  { body, cookie, headers }: Record<string, unknown> = {},
) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      ...(cookie ? { cookie: `cart_id=${cookie}` } : {}),
      ...(headers as Record<string, string>),
    },
  });
}

const bundle = (accessories: object[] = []) => ({
  bikeId: "bike-001",
  accessories,
});
const helmet = (quantity: number) => ({ accessoryId: "acc-001", quantity });

/** Adds one line and returns the cart cookie and the line id. */
async function cartWithOneLine() {
  const res = await addLine(
    call("POST", "/api/cart/lines", { body: bundle() }),
  );
  const cookie = res.cookies.get("cart_id")!.value;
  const lineId = (await res.json()).lines[0].id as string;
  return { cookie, lineId };
}

async function errorOf(res: Response) {
  return (await res.json()).error;
}

describe("POST /api/cart/lines", () => {
  it("201 returns the priced cart and sets the cart cookie for 7 days", async () => {
    const res = await addLine(
      call("POST", "/api/cart/lines", { body: bundle([helmet(2)]) }),
    );

    expect(res.status).toBe(201);
    const cookie = res.cookies.get("cart_id")!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.maxAge).toBe(604800);
    const cart = await res.json();
    expect(cart.id).toBe(cookie.value);
    expect(cart.lines).toHaveLength(1);
    expect(cart.totals.gross).toBe(cart.totals.net + cart.totals.tax);
  });

  it("keeps adding to the cart named by the cookie", async () => {
    const { cookie } = await cartWithOneLine();

    const res = await addLine(
      call("POST", "/api/cart/lines", { body: bundle(), cookie }),
    );

    expect((await res.json()).lines).toHaveLength(2);
  });

  it.each([
    ["a body that is not JSON", undefined],
    ["a missing bike", { accessories: [] }],
    ["a fractional quantity", bundle([helmet(1.5)])],
    ["a body that is not an object", 5],
  ])("400 invalid-request for %s", async (_name, body) => {
    const res = await addLine(call("POST", "/api/cart/lines", { body }));

    expect(res.status).toBe(400);
    expect((await errorOf(res)).code).toBe("invalid-request");
  });

  it.each([
    ["unknown-bike", { bikeId: "nope", accessories: [] }],
    ["unknown-accessory", bundle([{ accessoryId: "nope", quantity: 1 }])],
    [
      "incompatible-accessory",
      bundle([{ accessoryId: "acc-011", quantity: 1 }]),
    ],
    ["quantity-out-of-range", bundle([helmet(99)])],
  ])("422 %s", async (code, body) => {
    const res = await addLine(call("POST", "/api/cart/lines", { body }));

    expect(res.status).toBe(422);
    expect(await errorOf(res)).toMatchObject({ code });
    expect(res.cookies.get("cart_id")).toBeUndefined();
  });
});

describe("POST /api/cart/lines, further rejections", () => {
  it("422 duplicate-accessory when an accessory is listed twice", async () => {
    const res = await addLine(
      call("POST", "/api/cart/lines", { body: bundle([helmet(1), helmet(1)]) }),
    );

    expect(res.status).toBe(422);
    expect(await errorOf(res)).toMatchObject({ code: "duplicate-accessory" });
    expect(res.cookies.get("cart_id")).toBeUndefined();
  });

  it.each([
    ["a negative quantity", helmet(-1)],
    ["a quantity above the accessory's maximum", helmet(5)],
  ])("422 quantity-out-of-range for %s", async (_name, line) => {
    const res = await addLine(
      call("POST", "/api/cart/lines", { body: bundle([line]) }),
    );

    expect(res.status).toBe(422);
    expect(await errorOf(res)).toMatchObject({
      code: "quantity-out-of-range",
    });
  });

  it.each([
    ["accessories missing", { bikeId: "bike-001" }],
    ["a bike id that is not a string", { bikeId: 7, accessories: [] }],
    ["an empty bike id", { bikeId: "", accessories: [] }],
    [
      "a quantity that is a string",
      bundle([{ accessoryId: "acc-001", quantity: "2" }]),
    ],
    ["an accessory without an id", bundle([{ quantity: 1 }])],
    ["a null body", null],
  ])("400 invalid-request for %s", async (_name, body) => {
    const res = await addLine(call("POST", "/api/cart/lines", { body }));

    expect(res.status).toBe(400);
    expect((await errorOf(res)).code).toBe("invalid-request");
    expect(res.cookies.get("cart_id")).toBeUndefined();
  });

  it("ignores prices sent by the client and prices the line from the catalog", async () => {
    const honest = await (
      await addLine(
        call("POST", "/api/cart/lines", { body: bundle([helmet(2)]) }),
      )
    ).json();

    const res = await addLine(
      call("POST", "/api/cart/lines", {
        body: {
          ...bundle([{ ...helmet(2), netPrice: 1, price: 1 }]),
          netPrice: 1,
          price: 1,
          totals: { net: 1, tax: 0, gross: 1 },
        },
      }),
    );

    expect(res.status).toBe(201);
    const cart = await res.json();
    expect(cart.totals).toEqual(honest.totals);
    expect(cart.totals.net).toBeGreaterThan(1);
  });
});

describe("DELETE /api/cart/lines/{lineId}", () => {
  it("200 returns the cart without the line", async () => {
    const { cookie, lineId } = await cartWithOneLine();

    const res = await removeLine(
      call("DELETE", `/api/cart/lines/${lineId}`, { cookie }),
      { params: Promise.resolve({ lineId }) },
    );

    expect(res.status).toBe(200);
    expect((await res.json()).lines).toEqual([]);
  });

  it("404 line-not-found for a line that is not in the cart", async () => {
    const { cookie } = await cartWithOneLine();

    const res = await removeLine(
      call("DELETE", "/api/cart/lines/gone", { cookie }),
      { params: Promise.resolve({ lineId: "gone" }) },
    );

    expect(res.status).toBe(404);
    expect((await errorOf(res)).code).toBe("line-not-found");
  });

  it("404 line-not-found when there is no cart cookie", async () => {
    const res = await removeLine(call("DELETE", "/api/cart/lines/x"), {
      params: Promise.resolve({ lineId: "x" }),
    });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/cart", () => {
  it("200 returns the empty cart", async () => {
    const { cookie } = await cartWithOneLine();

    const res = await clearCart(call("DELETE", "/api/cart", { cookie }));

    expect(res.status).toBe(200);
    expect((await res.json()).lines).toEqual([]);
  });

  it("200 with no cookie, and sets none", async () => {
    const res = await clearCart(call("DELETE", "/api/cart"));

    expect(res.status).toBe(200);
    expect(res.cookies.get("cart_id")).toBeUndefined();
  });
});

describe("GET /api/availability", () => {
  it("200 returns the count of each product", async () => {
    const res = await availability(
      call("GET", "/api/availability?ids=bike-001,acc-001"),
    );

    expect(res.status).toBe(200);
    const { items } = await res.json();
    expect(items.map((i: { productId: string }) => i.productId)).toEqual([
      "bike-001",
      "acc-001",
    ]);
  });

  it.each([
    "/api/availability",
    "/api/availability?ids=",
    "/api/availability?ids=a,,b",
  ])("400 invalid-request for %s", async (path) => {
    const res = await availability(call("GET", path));

    expect(res.status).toBe(400);
    expect((await errorOf(res)).code).toBe("invalid-request");
  });

  it("503 stock-unavailable when the stock service fails", async () => {
    installStock({
      availability: async () => err({ code: "stock-unavailable" as const }),
    });

    const res = await availability(
      call("GET", "/api/availability?ids=bike-001"),
    );

    expect(res.status).toBe(503);
    expect((await errorOf(res)).code).toBe("stock-unavailable");
  });
});

describe("POST /api/checkout", () => {
  const key = { "Idempotency-Key": "k1" };

  it("200 confirmed with order id and totals, and empties the cart", async () => {
    installStock({ reserve: async () => ok(undefined) });
    const { cookie } = await cartWithOneLine();

    const res = await checkout(
      call("POST", "/api/checkout", { cookie, headers: key }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      status: "confirmed",
      orderId: expect.stringMatching(/^ORD-/),
      totals: { gross: expect.any(Number) },
    });
    const again = await clearCart(call("DELETE", "/api/cart", { cookie }));
    expect((await again.json()).lines).toEqual([]);
  });

  it("409 shortfall lists the short items", async () => {
    const items = [{ productId: "bike-001", requested: 1, available: 0 }];
    installStock({
      reserve: async () => err({ code: "shortfall" as const, items } as never),
    });
    const { cookie } = await cartWithOneLine();

    const res = await checkout(
      call("POST", "/api/checkout", { cookie, headers: key }),
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ status: "shortfall", items });
  });

  it("409 cart-empty for an empty cart and for no cookie", async () => {
    for (const cookie of ["fresh-cart", undefined]) {
      const res = await checkout(
        call("POST", "/api/checkout", { cookie, headers: key }),
      );

      expect(res.status).toBe(409);
      expect((await errorOf(res)).code).toBe("cart-empty");
    }
  });

  it("503 stock-unavailable with Retry-After", async () => {
    installStock({
      reserve: async () => err({ code: "stock-unavailable" as const }),
    });
    const { cookie } = await cartWithOneLine();

    const res = await checkout(
      call("POST", "/api/checkout", { cookie, headers: key }),
    );

    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).not.toBeNull();
    expect(await res.json()).toEqual({ status: "stock-unavailable" });
  });

  it("400 invalid-request without an Idempotency-Key", async () => {
    const { cookie } = await cartWithOneLine();

    const res = await checkout(call("POST", "/api/checkout", { cookie }));

    expect(res.status).toBe(400);
    expect((await errorOf(res)).code).toBe("invalid-request");
  });

  it("replays the stored order for a repeated key", async () => {
    installStock({ reserve: async () => ok(undefined) });
    const { cookie } = await cartWithOneLine();
    const send = () =>
      checkout(call("POST", "/api/checkout", { cookie, headers: key }));

    const first = await (await send()).json();
    const second = await (await send()).json();

    expect(second).toEqual(first);
  });
});

describe("concurrent POST /api/checkout", () => {
  function countingStock(delayMs = 20) {
    const reservations: unknown[] = [];
    installStock({
      reserve: async (items) => {
        reservations.push(items);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return ok(undefined);
      },
    });
    return reservations;
  }
  const send = (cookie: string, k: string) =>
    checkout(
      call("POST", "/api/checkout", {
        cookie,
        headers: { "Idempotency-Key": k },
      }),
    );

  it("one order and one reservation for requests that share a key", async () => {
    const reservations = countingStock();
    const { cookie } = await cartWithOneLine();

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => send(cookie, "same")),
    );

    const bodies = await Promise.all(responses.map((res) => res.json()));
    expect(responses.map((res) => res.status)).toEqual([
      200, 200, 200, 200, 200,
    ]);
    expect(new Set(bodies.map((body) => body.orderId)).size).toBe(1);
    expect(reservations).toHaveLength(1);
  });

  it("reserves the lines of one cart once when keys differ", async () => {
    const reservations = countingStock();
    const { cookie } = await cartWithOneLine();

    const responses = await Promise.all(
      ["a", "b", "c"].map((k) => send(cookie, k)),
    );

    // Keys differ, so each is its own checkout, but the same lines must not be
    // reserved (paid) twice: every call is answered by the one reservation.
    expect(responses.map((res) => res.status)).toEqual([200, 200, 200]);
    expect(reservations).toHaveLength(1);
    const cart = await clearCart(call("DELETE", "/api/cart", { cookie }));
    expect((await cart.json()).lines).toEqual([]);
  });
});

describe("POST /api/checkout while a line is added", () => {
  it("keeps a line added during the reservation in the cart", async () => {
    let release!: () => void;
    let reserving!: () => void;
    const started = new Promise<void>((resolve) => (reserving = resolve));
    const gate = new Promise<void>((resolve) => (release = resolve));
    installStock({
      reserve: async () => {
        reserving();
        await gate;
        return ok(undefined);
      },
    });
    const { cookie, lineId } = await cartWithOneLine();

    const pending = checkout(
      call("POST", "/api/checkout", {
        cookie,
        headers: { "Idempotency-Key": "k-during" },
      }),
    );
    await started;
    const added = await addLine(
      call("POST", "/api/cart/lines", { body: bundle(), cookie }),
    );
    const newLineId = (await added.json()).lines[1].id as string;
    release();
    const res = await pending;

    expect(res.status).toBe(200);
    const left = await (
      await removeLine(
        call("DELETE", `/api/cart/lines/${newLineId}`, { cookie }),
        { params: Promise.resolve({ lineId: newLineId }) },
      )
    ).json();
    // The new line was still there to remove; the paid line is gone.
    expect(left.lines).toEqual([]);
    const gone = await removeLine(
      call("DELETE", `/api/cart/lines/${lineId}`, { cookie }),
      { params: Promise.resolve({ lineId }) },
    );
    expect(gone.status).toBe(404);
  });
});
