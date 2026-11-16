"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { CartView } from "@/application/cart";
import { Alert } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { formatMoney } from "@/ui/format";
import { Price } from "@/ui/price";
import {
  clearCart,
  placeOrder,
  removeLine,
  type OrderOutcome,
} from "./cart-api";

export function CartScreen({ cart }: { cart: CartView | null }) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<OrderOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [ordering, setOrdering] = useState(false);
  // One key per attempt: a retry of the same attempt reuses it.
  const keyRef = useRef<string | null>(null);
  const inFlight = useRef(false);

  // The cart page stays mounted while the customer is elsewhere (hidden pages
  // keep their state), so a finished order's result would outlive the visit.
  // When fresh server data arrives with lines in it, that result is history.
  const [seenCart, setSeenCart] = useState(cart);
  if (cart !== seenCart) {
    setSeenCart(cart);
    const finishedOrder =
      outcome?.kind === "confirmed" || outcome?.kind === "cart-empty";
    if (finishedOrder && (cart?.lines.length ?? 0) > 0) setOutcome(null);
  }

  // "Place order" disappears when the order is confirmed or the cart turns
  // out empty; move focus to the result so it is read and the page is not lost.
  const resultRef = useRef<HTMLDivElement>(null);
  const finished =
    outcome?.kind === "confirmed" || outcome?.kind === "cart-empty";
  useEffect(() => {
    if (finished) resultRef.current?.focus();
  }, [finished]);

  const lines = cart?.lines ?? [];

  const names = new Map<string, string>();
  for (const line of lines) {
    names.set(line.bike.id, line.bike.name);
    for (const { accessory } of line.accessories) {
      names.set(accessory.id, accessory.name);
    }
  }
  const short = new Set(
    outcome?.kind === "shortfall" ? outcome.items.map((i) => i.productId) : [],
  );

  const refresh = () => startTransition(() => router.refresh());

  async function order() {
    if (inFlight.current) return;
    inFlight.current = true;
    setOrdering(true);
    keyRef.current ??= crypto.randomUUID();
    const result = await placeOrder(keyRef.current);
    // The attempt is over unless it can be retried as the same one.
    if (result.kind !== "stock-unavailable" && result.kind !== "failed") {
      keyRef.current = null;
    }
    setOutcome(result);
    inFlight.current = false;
    setOrdering(false);
    if (result.kind === "confirmed" || result.kind === "cart-empty") refresh();
  }

  async function change(action: () => Promise<boolean>) {
    setError(null);
    if (await action()) {
      keyRef.current = null;
      setOutcome(null);
      refresh();
    } else {
      setError("Something went wrong. Please try again.");
    }
  }

  if (outcome?.kind === "confirmed") {
    return (
      <Card ref={resultRef} tabIndex={-1} className="space-y-4 outline-none">
        <Alert tone="success">
          Order confirmed. Order number {outcome.orderId}. Total{" "}
          {formatMoney(outcome.gross)}.
        </Alert>
        <Link href="/" className="font-medium underline">
          Configure another bike
        </Link>
      </Card>
    );
  }

  if (lines.length === 0 || outcome?.kind === "cart-empty") {
    return (
      <Card ref={resultRef} tabIndex={-1} className="space-y-4 outline-none">
        {outcome?.kind === "cart-empty" ? (
          <Alert tone="warning">
            Your cart is empty, so no order was placed.
          </Alert>
        ) : (
          <p>Your cart is empty.</p>
        )}
        <Link href="/" className="font-medium underline">
          Configure a bike
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {outcome?.kind === "stock-unavailable" && (
        <Alert tone="error">
          We couldn&apos;t reach the stock service, so your order was not
          placed. Your cart is unchanged.
        </Alert>
      )}
      {outcome?.kind === "failed" && (
        <Alert tone="error">
          Something went wrong and your order was not placed.
        </Alert>
      )}
      {outcome?.kind === "shortfall" && (
        <Alert tone="warning">
          <p>
            Some items are no longer available in the quantity you asked for.
          </p>
          <ul className="mt-1 list-disc pl-5">
            {outcome.items.map((item) => (
              <li key={item.productId}>
                {names.get(item.productId) ?? item.productId}: {item.requested}{" "}
                requested, {item.available} available.
              </li>
            ))}
          </ul>
          <p className="mt-1">Remove the flagged bundle, then order again.</p>
        </Alert>
      )}
      {error && <Alert tone="error">{error}</Alert>}

      <ul className="space-y-3">
        {lines.map((line) => {
          const flagged =
            short.has(line.bike.id) ||
            line.accessories.some((a) => short.has(a.accessory.id));
          return (
            <li key={line.id}>
              <Card className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-medium">{line.bike.name}</h2>
                  {flagged && (
                    <span className="text-sm text-warn">Not available</span>
                  )}
                </div>
                <ul className="text-sm text-ink-muted">
                  {line.accessories
                    .filter((a) => a.quantity > 0)
                    .map((a) => (
                      <li key={a.accessory.id}>
                        {a.quantity} × {a.accessory.name}
                      </li>
                    ))}
                </ul>
                <Price
                  gross={line.price.gross}
                  net={line.price.net}
                  note="incl. VAT"
                />
                <Button
                  variant="secondary"
                  disabled={pending || ordering}
                  onClick={() => change(() => removeLine(line.id))}
                >
                  Remove
                  <span className="sr-only"> {line.bike.name} bundle</span>
                </Button>
              </Card>
            </li>
          );
        })}
      </ul>

      {cart && (
        <Card className="space-y-3">
          <div aria-live="polite">
            <p className="text-sm text-ink-muted">Total</p>
            <Price
              gross={cart.totals.gross}
              net={cart.totals.net}
              note="incl. VAT"
            />
          </div>
          <div className="flex gap-2">
            <Button pending={ordering} onClick={order}>
              Place order
            </Button>
            <Button
              variant="ghost"
              disabled={pending || ordering}
              onClick={() => change(clearCart)}
            >
              Clear cart
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
