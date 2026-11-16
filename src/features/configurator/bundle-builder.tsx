"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { availabilityResponse } from "@/contracts/api";
import { isCompatible, type Accessory } from "@/domain/accessory";
import type { Bike } from "@/domain/bike";
import { createBundle, priceBundle } from "@/domain/bundle";
import { priceOf, type Cents, type TaxRateBp } from "@/domain/money";
import type { Quantity } from "@/domain/quantity";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { formatMoney, formatPercent } from "@/ui/format";
import { Price } from "@/ui/price";
import { RadioCard } from "@/ui/radio-card";
import { Slider } from "@/ui/slider";
import { addLine } from "./add-line";
import { StockBadge } from "./stock-badge";
import { exceedsStock, type StockState } from "./stock";

type Props = {
  bikes: readonly Bike[];
  accessories: readonly Accessory[];
};

type Availability =
  | { readonly status: "loading" }
  | { readonly status: "unknown" }
  | { readonly status: "ready"; readonly counts: ReadonlyMap<string, number> };

type Notice =
  | { readonly kind: "added" }
  | { readonly kind: "error"; readonly message: string };

function grossOf(product: { netPrice: Cents; taxRate: TaxRateBp }) {
  return priceOf([{ net: product.netPrice, taxRate: product.taxRate }]).gross;
}

const VAT_NOTE = (rate: number) => `incl. ${formatPercent(rate)} VAT`;

export function BundleBuilder({ bikes, accessories }: Props) {
  const router = useRouter();
  const [bikeId, setBikeId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<
    Readonly<Record<string, number>>
  >({});
  const [availability, setAvailability] = useState<Availability>({
    status: "loading",
  });
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [adding, setAdding] = useState(false);
  const [refreshing, startTransition] = useTransition();

  // One request for every product (A10). Retry bumps `attempt`; the effect's
  // cleanup aborts the older request.
  useEffect(() => {
    const controller = new AbortController();
    const ids = [...bikes, ...accessories].map((product) => product.id);
    fetch(`/api/availability?ids=${ids.join(",")}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = availabilityResponse.safeParse(
          response.ok ? await response.json() : null,
        );
        if (!body.success) throw new Error("no availability");
        return new Map(body.data.items.map((i) => [i.productId, i.available]));
      })
      .then((counts) => setAvailability({ status: "ready", counts }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setAvailability({ status: "unknown" });
      });
    return () => controller.abort();
  }, [bikes, accessories, attempt]);

  function retryAvailability() {
    setAvailability({ status: "loading" });
    setAttempt((n) => n + 1);
  }

  useEffect(() => {
    const clear = () => document.hidden && setNotice(null);
    document.addEventListener("visibilitychange", clear);
    return () => document.removeEventListener("visibilitychange", clear);
  }, []);

  const stockOf = (id: string): StockState => {
    if (availability.status === "loading") return { kind: "loading" };
    const available =
      availability.status === "ready" ? availability.counts.get(id) : undefined;
    return available === undefined
      ? { kind: "unknown" }
      : { kind: "known", available };
  };

  const bike = bikes.find((candidate) => candidate.id === bikeId);
  const compatible = bike
    ? accessories.filter((accessory) => isCompatible(accessory, bike))
    : [];
  const incompatible = bike
    ? accessories.filter((accessory) => !isCompatible(accessory, bike))
    : [];

  const selection = useMemo(
    () =>
      compatible.flatMap((accessory) => {
        const quantity = quantities[accessory.id] ?? 0;
        return quantity > 0
          ? [{ accessory, quantity: quantity as Quantity }]
          : [];
      }),
    // `compatible` is derived from `bike`, so `bike` stands for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bike, accessories, quantities],
  );
  const bundle = bike ? createBundle(bike, selection) : undefined;
  const price = bundle?.ok ? priceBundle(bundle.value) : undefined;

  const problems: string[] = [];
  if (bike && exceedsStock(stockOf(bike.id), 1)) {
    problems.push(`${bike.name} is out of stock. Choose another bike.`);
  }
  for (const { accessory, quantity } of selection) {
    const stock = stockOf(accessory.id);
    if (stock.kind === "known" && exceedsStock(stock, quantity)) {
      problems.push(
        `Only ${stock.available} of ${accessory.name} available. Lower the quantity.`,
      );
    }
  }
  const stockUnknown = availability.status === "unknown";

  function chooseBike(id: string) {
    const next = bikes.find((candidate) => candidate.id === id);
    if (!next) return;
    setBikeId(id);
    setNotice(null);
    // Keep the quantities of accessories that still fit; drop the rest.
    setQuantities((current) =>
      Object.fromEntries(
        accessories
          .filter((a) => isCompatible(a, next) && (current[a.id] ?? 0) > 0)
          .map((a) => [a.id, current[a.id] ?? 0]),
      ),
    );
  }

  function setQuantity(id: string, value: number) {
    setNotice(null);
    setQuantities((current) => ({ ...current, [id]: value }));
  }

  async function add() {
    if (!bike || !bundle?.ok || adding) return;
    setNotice(null);
    setAdding(true);
    const result = await addLine({
      bikeId: bike.id,
      accessories: selection.map(({ accessory, quantity }) => ({
        accessoryId: accessory.id,
        quantity,
      })),
    });
    setAdding(false);
    if (!result.ok) {
      setNotice({ kind: "error", message: result.message });
      return;
    }
    setNotice({ kind: "added" });
    setBikeId(null);
    setQuantities({});
    startTransition(() => router.refresh());
  }

  const canAdd = price !== undefined && problems.length === 0;

  return (
    <div className="grid gap-6 pb-32 lg:grid-cols-[1fr_24rem] lg:pb-0">
      <section aria-labelledby="bikes-heading" className="space-y-3">
        <h2 id="bikes-heading" className="text-lg font-semibold">
          1. Choose a bike
        </h2>
        <div
          role="radiogroup"
          aria-labelledby="bikes-heading"
          className="grid gap-3 sm:grid-cols-2"
        >
          {bikes.map((candidate) => (
            <RadioCard
              key={candidate.id}
              name="bike"
              value={candidate.id}
              checked={candidate.id === bikeId}
              onChange={chooseBike}
            >
              <span className="block font-medium">{candidate.name}</span>
              <span className="block text-sm text-ink-muted">
                {candidate.frameType} frame
              </span>
              <span className="mt-2 block">
                <Price
                  gross={grossOf(candidate)}
                  net={candidate.netPrice}
                  note={VAT_NOTE(candidate.taxRate)}
                />
              </span>
              <span className="mt-2 block">
                <StockBadge state={stockOf(candidate.id)} />
              </span>
            </RadioCard>
          ))}
        </div>
      </section>

      <div className="space-y-6 lg:col-start-2 lg:row-start-1">
        <section aria-labelledby="acc-heading" className="space-y-3">
          <h2 id="acc-heading" className="text-lg font-semibold">
            2. Add accessories
          </h2>
          {availability.status === "unknown" && (
            <Alert tone="warning">
              Stock is unknown right now.{" "}
              <button
                type="button"
                className="font-medium underline"
                onClick={retryAvailability}
              >
                Retry
              </button>
            </Alert>
          )}
          {!bike && (
            <p className="text-sm text-ink-muted">
              Select a bike to see matching accessories
            </p>
          )}
          {bike && (
            <ul className="space-y-3">
              {compatible.map((accessory) => (
                <li key={accessory.id}>
                  <Card>
                    <AccessoryHead
                      accessory={accessory}
                      stock={stockOf(accessory.id)}
                    />
                    <Slider
                      label={accessory.name}
                      value={quantities[accessory.id] ?? 0}
                      max={accessory.maxAmount}
                      onChange={(value) => setQuantity(accessory.id, value)}
                    />
                  </Card>
                </li>
              ))}
            </ul>
          )}
          {bike && incompatible.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-ink-muted">
                Not compatible with {bike.frameType} frames
              </h3>
              <ul className="space-y-3">
                {incompatible.map((accessory) => (
                  <li key={accessory.id}>
                    <Card className="bg-surface-muted opacity-70">
                      <AccessoryHead accessory={accessory} />
                      <p className="text-sm text-ink-muted">
                        Fits {accessory.compatibleFrameTypes.join(", ")} frames
                        only.
                      </p>
                    </Card>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section
          aria-labelledby="summary-heading"
          className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface p-4 lg:sticky lg:top-4 lg:rounded-card lg:border"
        >
          <h2
            id="summary-heading"
            className="sr-only lg:not-sr-only lg:mb-2 lg:text-lg lg:font-semibold"
          >
            Your bundle
          </h2>
          <div aria-live="polite" className="space-y-1 text-sm">
            {price ? (
              <>
                <div className="hidden justify-between lg:flex">
                  <span>Net</span>
                  <span>{formatMoney(price.net)}</span>
                </div>
                <div className="hidden justify-between lg:flex">
                  <span>VAT</span>
                  <span>{formatMoney(price.tax)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span>{formatMoney(price.gross)}</span>
                </div>
              </>
            ) : (
              <p className="text-ink-muted">Select a bike to see the price.</p>
            )}
          </div>
          <div className="mt-3 space-y-2">
            {problems.map((problem) => (
              <Alert key={problem} tone="warning">
                {problem}
              </Alert>
            ))}
            {stockUnknown && price && (
              <p className="text-xs text-ink-muted">
                We&apos;ll confirm stock at checkout
              </p>
            )}
            {notice?.kind === "added" && (
              <Alert tone="success">
                Bundle added to your cart.{" "}
                <Link href="/cart" className="font-medium underline">
                  View cart
                </Link>
              </Alert>
            )}
            {notice?.kind === "error" && (
              <Alert tone="error">{notice.message}</Alert>
            )}
            <Button
              className="w-full"
              disabled={!canAdd}
              pending={adding || refreshing}
              onClick={add}
            >
              {adding ? "Adding…" : "Add to cart"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

function AccessoryHead({
  accessory,
  stock,
}: {
  accessory: Accessory;
  stock?: StockState;
}) {
  return (
    <div className="mb-2 flex items-start justify-between gap-3">
      <div>
        <p className="font-medium">{accessory.name}</p>
        <Price
          gross={grossOf(accessory)}
          net={accessory.netPrice}
          note={VAT_NOTE(accessory.taxRate)}
        />
      </div>
      {stock && <StockBadge state={stock} />}
    </div>
  );
}
