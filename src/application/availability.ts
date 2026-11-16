import { err, type Result } from "@/domain/result";
import type {
  Availability,
  ProductId,
  StockService,
  StockUnavailable,
} from "./ports";
import { withTimeout } from "./timeout";

export const AVAILABILITY_TIMEOUT_MS = 2000;

export type AvailabilityDeps = { readonly stock: StockService };

const UNAVAILABLE: Result<never, StockUnavailable> = err({
  code: "stock-unavailable",
});

/**
 * How many of each product are in stock, as a hint for the customer.
 *
 * A read is safe to repeat, so a failed or slow call is tried once more.
 * A call that gives no answer in time counts as `stock-unavailable`.
 */
export async function getAvailability(
  { stock }: AvailabilityDeps,
  productIds: readonly ProductId[],
): Promise<Result<readonly Availability[], StockUnavailable>> {
  const attempt = () =>
    withTimeout(
      stock.availability(productIds),
      AVAILABILITY_TIMEOUT_MS,
      UNAVAILABLE,
    );

  const first = await attempt();
  return first.ok ? first : attempt();
}
