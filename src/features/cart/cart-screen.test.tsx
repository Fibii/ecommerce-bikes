import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CartView } from "@/application/cart";
import { CartScreen } from "./cart-screen";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const price = { net: 10000, tax: 1900, gross: 11900 };
const cart = {
  id: "c1",
  lines: [
    {
      id: "l1",
      bike: {
        id: "b1",
        name: "Road Racer",
        frameType: "Road",
        netPrice: 10000,
        taxRate: 1900,
      },
      accessories: [
        {
          accessory: {
            id: "a1",
            name: "Helmet",
            netPrice: 0,
            taxRate: 1900,
            compatibleFrameTypes: ["Road"],
            maxAmount: 3,
          },
          quantity: 2,
        },
      ],
      price,
    },
  ],
  totals: price,
} as unknown as CartView;

// jsdom has no Response; the code under test only reads ok, status and json().
const reply = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: async () => body });

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  refresh.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

const placeOrderButton = () =>
  screen.getByRole("button", { name: "Place order" });

describe("checkout result", () => {
  it("shows the confirmed order", async () => {
    fetchMock.mockReturnValue(
      reply({ status: "confirmed", orderId: "ORD-1", totals: price }),
    );
    render(<CartScreen cart={cart} />);
    fireEvent.click(placeOrderButton());
    expect(
      await screen.findByText(
        /Order confirmed\. Order number ORD-1\. Total €119\.00\./,
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Configure another bike" }),
    ).toBeTruthy();

    // Place order is gone; focus moves to the result instead of the page top.
    expect(document.activeElement?.textContent).toContain("Order confirmed");
  });

  it("lists the shortfall with requested and available", async () => {
    fetchMock.mockReturnValue(
      reply(
        {
          status: "shortfall",
          items: [{ productId: "a1", requested: 2, available: 1 }],
        },
        409,
      ),
    );
    render(<CartScreen cart={cart} />);
    fireEvent.click(placeOrderButton());
    expect(
      await screen.findByText("Helmet: 2 requested, 1 available."),
    ).toBeTruthy();
    expect(screen.getByText("Not available")).toBeTruthy();
  });

  it("offers a retry when the stock service is unavailable, with the same key", async () => {
    fetchMock.mockReturnValue(reply({ status: "stock-unavailable" }, 503));
    render(<CartScreen cart={cart} />);
    fireEvent.click(placeOrderButton());
    expect(
      await screen.findByText(/couldn't reach the stock service/),
    ).toBeTruthy();
    await waitFor(() =>
      expect(placeOrderButton().hasAttribute("disabled")).toBe(false),
    );
    fireEvent.click(placeOrderButton());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const key = (call: number) =>
      fetchMock.mock.calls[call][1].headers["Idempotency-Key"];
    expect(key(1)).toBe(key(0));
  });

  it("says the cart is empty when the server says so", async () => {
    fetchMock.mockReturnValue(
      reply({ error: { code: "cart-empty", message: "empty" } }, 409),
    );
    render(<CartScreen cart={cart} />);
    fireEvent.click(placeOrderButton());
    expect(
      await screen.findByText(/cart is empty, so no order was placed/),
    ).toBeTruthy();
  });

  it("sends one request with one key on a double click", async () => {
    fetchMock.mockReturnValue(
      reply({ status: "confirmed", orderId: "ORD-1", totals: price }),
    );
    render(<CartScreen cart={cart} />);
    fireEvent.click(placeOrderButton());
    fireEvent.click(placeOrderButton());
    await screen.findByText(/Order confirmed/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].headers["Idempotency-Key"]).toBeTruthy();
  });
});

describe("remove line", () => {
  it("deletes the line and refreshes, also when it was already gone", async () => {
    fetchMock.mockReturnValue(
      reply({ error: { code: "line-not-found", message: "" } }, 404),
    );
    render(<CartScreen cart={cart} />);
    fireEvent.click(screen.getByRole("button", { name: /Remove/ }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith("/api/cart/lines/l1", {
      method: "DELETE",
    });
  });
});
