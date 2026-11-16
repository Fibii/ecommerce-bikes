import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { Accessory } from "@/domain/accessory";
import type { Bike } from "@/domain/bike";
import type { Cents, TaxRateBp } from "@/domain/money";
import type { Quantity } from "@/domain/quantity";
import { BundleBuilder } from "./bundle-builder";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const bike = (id: string, name: string, frameType: Bike["frameType"]) =>
  ({
    id,
    name,
    frameType,
    netPrice: 100000,
    taxRate: 1900,
  }) as unknown as Bike;

const accessory = (
  id: string,
  name: string,
  frames: Accessory["compatibleFrameTypes"],
) =>
  ({
    id,
    name,
    netPrice: 5000 as Cents,
    taxRate: 1900 as TaxRateBp,
    compatibleFrameTypes: frames,
    maxAmount: 3 as Quantity,
  }) as unknown as Accessory;

const bikes = [
  bike("b1", "Road Racer", "Road"),
  bike("b2", "Trail", "Mountain"),
];
const accessories = [
  accessory("a1", "Helmet", ["Road", "Mountain"]),
  accessory("a2", "Mud Guard", ["Mountain"]),
];

// jsdom has no Response; the code under test only reads ok, status and json().
const reply = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;

function mockFetch(availability: Record<string, number> | "fail") {
  const calls: { url: string; init?: RequestInit }[] = [];
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url.startsWith("/api/availability")) {
      if (availability === "fail") return reply({}, 503);
      const items = Object.entries(availability).map(
        ([productId, available]) => ({
          productId,
          available,
        }),
      );
      return reply({ items });
    }
    return reply({}, 201);
  }) as unknown as typeof fetch;
  return calls;
}

function chooseBike(name: string) {
  fireEvent.click(screen.getByRole("radio", { name: new RegExp(name) }));
}

function setSlider(name: string, value: number) {
  fireEvent.change(screen.getByRole("slider", { name }), {
    target: { value: String(value) },
  });
}

beforeEach(() => refresh.mockClear());

it("shows gross, net and the bundle total once a bike is chosen", async () => {
  mockFetch({ b1: 9, b2: 9, a1: 9, a2: 9 });
  render(<BundleBuilder bikes={bikes} accessories={accessories} />);

  chooseBike("Road Racer");
  setSlider("Helmet", 1);

  // 1000.00 + 50.00 net, 19 % VAT: 1,249.50 gross.
  expect(screen.getByText("€1,249.50")).toBeInTheDocument();
  expect(screen.getByText("€1,050.00")).toBeInTheDocument();
  expect(screen.getByText("€199.50")).toBeInTheDocument();
});

it("lists incompatible accessories last, disabled, with the reason", async () => {
  mockFetch({ b1: 9, b2: 9, a1: 9, a2: 9 });
  render(<BundleBuilder bikes={bikes} accessories={accessories} />);

  chooseBike("Road Racer");

  const group = screen.getByRole("heading", {
    name: "Not compatible with Road frames",
  }).parentElement as HTMLElement;
  expect(within(group).getByText("Mud Guard")).toBeInTheDocument();
  expect(within(group).getByText(/Fits Mountain frames only/)).toBeVisible();
  expect(within(group).queryByRole("slider")).toBeNull();
  expect(screen.getAllByRole("slider")).toHaveLength(1);
});

it("blocks Add to cart on a known shortfall but not on unknown stock", async () => {
  mockFetch({ b1: 0, b2: 9, a1: 9, a2: 9 });
  const { unmount } = render(
    <BundleBuilder bikes={bikes} accessories={accessories} />,
  );
  chooseBike("Road Racer");
  await screen.findByText("Out of stock");
  expect(screen.getByRole("button", { name: "Add to cart" })).toBeDisabled();
  unmount();

  mockFetch("fail");
  render(<BundleBuilder bikes={bikes} accessories={accessories} />);
  chooseBike("Road Racer");
  await screen.findAllByText("Stock unknown");
  expect(screen.getByRole("button", { name: "Add to cart" })).toBeEnabled();
  expect(screen.getByText(/confirm stock at checkout/)).toBeInTheDocument();
});

it("posts the bundle without prices, then confirms and resets", async () => {
  const calls = mockFetch({ b1: 9, b2: 9, a1: 9, a2: 9 });
  render(<BundleBuilder bikes={bikes} accessories={accessories} />);

  chooseBike("Road Racer");
  setSlider("Helmet", 2);
  fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));

  await screen.findByRole("link", { name: "View cart" });
  const post = calls.find((call) => call.url === "/api/cart/lines");
  expect(JSON.parse(post?.init?.body as string)).toEqual({
    bikeId: "b1",
    accessories: [{ accessoryId: "a1", quantity: 2 }],
  });
  await waitFor(() => expect(refresh).toHaveBeenCalled());
  expect(screen.getByRole("radio", { name: /Road Racer/ })).not.toBeChecked();
});

it("ignores a stale availability answer that arrives after a newer one", async () => {
  const answers: ((counts: Record<string, number>) => void)[] = [];
  global.fetch = jest.fn(
    () =>
      new Promise<Response>((resolve) => {
        answers.push((counts) =>
          resolve(
            reply({
              items: Object.entries(counts).map(([productId, available]) => ({
                productId,
                available,
              })),
            }),
          ),
        );
      }),
  ) as unknown as typeof fetch;
  const { rerender } = render(
    <BundleBuilder bikes={bikes} accessories={accessories} />,
  );
  // A new accessories array re-runs the fetch effect, like a retry does.
  rerender(<BundleBuilder bikes={bikes} accessories={[...accessories]} />);
  expect(answers).toHaveLength(2);

  answers[1]?.({ b1: 9, b2: 9, a1: 9, a2: 9 });
  await screen.findAllByText("In stock");
  await act(async () => {
    answers[0]?.({ b1: 1, b2: 1, a1: 1, a2: 1 });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  expect(screen.queryAllByText("Only 1 left")).toHaveLength(0);
  expect(screen.getAllByText("In stock").length).toBeGreaterThan(0);
});

it("aborts the older availability request and ignores its late answer or failure", async () => {
  const pending: {
    signal?: AbortSignal | null;
    resolve: (r: Response) => void;
    reject: (e: unknown) => void;
  }[] = [];
  global.fetch = jest.fn(
    (_url: string, init?: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        pending.push({ signal: init?.signal, resolve, reject });
      }),
  ) as unknown as typeof fetch;
  const { rerender } = render(
    <BundleBuilder bikes={bikes} accessories={accessories} />,
  );
  rerender(<BundleBuilder bikes={bikes} accessories={[...accessories]} />);
  expect(pending).toHaveLength(2);
  expect(pending[0]?.signal?.aborted).toBe(true);
  expect(pending[1]?.signal?.aborted).toBe(false);

  // The aborted request fails, as fetch does; that must not read as "unknown".
  pending[0]?.reject(new DOMException("aborted", "AbortError"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(screen.queryByText(/Stock is unknown right now/)).toBeNull();

  pending[1]?.resolve(
    reply({
      items: ["b1", "b2", "a1", "a2"].map((productId) => ({
        productId,
        available: 9,
      })),
    }),
  );
  await screen.findAllByText("In stock");
  expect(screen.queryByText(/Stock is unknown right now/)).toBeNull();
});
