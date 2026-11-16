/** A placeholder. Decorative: the screen announces loading once, not per badge. */
export function Skeleton() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-5 w-16 animate-pulse rounded-full bg-surface-muted"
    />
  );
}
