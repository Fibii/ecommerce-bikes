import type { ReactNode } from "react";
import { cx } from "./cx";

type RadioCardProps = {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  children: ReactNode;
};

/** A native radio input drawn as a card: arrow keys and focus come with it. */
export function RadioCard({
  name,
  value,
  checked,
  onChange,
  children,
}: RadioCardProps) {
  return (
    <label
      className={cx(
        "relative block cursor-pointer rounded-card border bg-surface p-4 hover:bg-surface-muted",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
        checked ? "border-primary ring-1 ring-primary" : "border-line",
      )}
    >
      <input
        type="radio"
        className="sr-only"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
      />
      {checked && (
        <span
          aria-hidden="true"
          className="absolute right-3 top-3 text-primary"
        >
          ✓
        </span>
      )}
      {children}
    </label>
  );
}
