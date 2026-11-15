import type { Result } from "./result";

/**
 * Test helper: the value of a result that the test expects to succeed.
 * Throws otherwise, which fails the test with the typed error in the message.
 */
export function must<T>(result: Result<T, unknown>): T {
  if (!result.ok) {
    throw new Error(`Expected ok, got ${JSON.stringify(result.error)}`);
  }
  return result.value;
}
