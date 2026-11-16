export function Skeleton({ label }: { label: string }) {
  return (
    <span
      role="status"
      aria-label={label}
      className="inline-block h-5 w-16 animate-pulse rounded-full bg-surface-muted"
    />
  );
}
