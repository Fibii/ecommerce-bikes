export type InvalidId = {
  readonly code: "invalid-id";
  readonly value: string;
};

/** An id is at least one character and holds no whitespace. */
export function isValidId(value: string): boolean {
  return /^\S+$/.test(value);
}
