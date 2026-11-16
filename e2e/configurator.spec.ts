import { expect, test, type Page } from "@playwright/test";

// Stock levels are derived from the product id and the default seed, so these
// tests rely on: bike-001 (Touring) in stock, acc-004 (GPS computer) in stock,
// acc-009 (child seat) with stock 1 (two bundles of one exceed it at checkout),
// acc-011 and acc-012 (Road-only) incompatible with a Touring bike.
const BIKE = "Touring Voyager 5.0";

async function chooseBike(page: Page) {
  await page.goto("/");
  // The radio input is visually hidden (sr-only); click its visible label.
  const radio = page.getByRole("radio", { name: new RegExp(BIKE) });
  await page.locator("label", { has: radio }).click();
  await expect(radio).toBeChecked();
}

async function addBundle(page: Page, accessory: string, amount: string) {
  await chooseBike(page);
  await page.getByRole("slider", { name: accessory }).fill(amount);
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByText("Bundle added to your cart.")).toBeVisible();
}

test("configure a bundle, add it to the cart and place the order", async ({
  page,
}) => {
  await addBundle(page, "GPS Bike Computer Basic", "1");

  await page.getByRole("link", { name: "View cart" }).click();
  await expect(page.getByRole("heading", { name: BIKE })).toBeVisible();

  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByText(/Order confirmed/)).toBeVisible();
});

test("an incompatible accessory is disabled and says why", async ({ page }) => {
  await chooseBike(page);

  await expect(
    page.getByRole("heading", { name: "Not compatible with Touring frames" }),
  ).toBeVisible();
  await expect(page.getByText("Fits Road frames only.").first()).toBeVisible();
  await expect(
    page.getByRole("slider", { name: "Race Ultralight Clipless Pedals" }),
  ).toHaveCount(0);
});

test("a stock shortfall at checkout names the short item", async ({ page }) => {
  await addBundle(page, "FamilyRide Child Seat", "1");
  await addBundle(page, "FamilyRide Child Seat", "1");

  await page.goto("/cart");
  await page.getByRole("button", { name: "Place order" }).click();

  await expect(
    page.getByText("Some items are no longer available"),
  ).toBeVisible();
  await expect(
    page.getByText("FamilyRide Child Seat: 2 requested, 1 available."),
  ).toBeVisible();
});

test.describe("when the stock service is down", () => {
  test.use({ baseURL: "http://localhost:3001" });

  test("the order is not placed and the cart is kept", async ({ page }) => {
    await addBundle(page, "GPS Bike Computer Basic", "1");

    await page.goto("/cart");
    await page.getByRole("button", { name: "Place order" }).click();

    await expect(
      page.getByText(/couldn.t reach the stock service/),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: BIKE })).toBeVisible();
  });
});
