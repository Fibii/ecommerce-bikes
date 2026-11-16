import type { IdempotencyStore } from "@/application/ports";

/** Keeps outcomes in memory, for one long-lived Node process. */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly outcomes = new Map<string, Promise<unknown>>();

  run<T>(
    key: string,
    work: () => Promise<T>,
    keep: (outcome: T) => boolean,
  ): Promise<T> {
    const existing = this.outcomes.get(key);
    if (existing) return existing as Promise<T>;

    const pending = work().then(
      (outcome) => {
        if (!keep(outcome)) this.outcomes.delete(key);
        return outcome;
      },
      (error: unknown) => {
        this.outcomes.delete(key);
        throw error;
      },
    );
    this.outcomes.set(key, pending);
    return pending;
  }
}
