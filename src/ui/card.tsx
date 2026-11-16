import type { ComponentProps } from "react";
import { cx } from "./cx";

export function Card({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      {...rest}
      className={cx(
        "rounded-card border border-line bg-surface p-4",
        className,
      )}
    />
  );
}
