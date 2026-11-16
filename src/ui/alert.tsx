import type { ReactNode } from "react";
import { cx } from "./cx";

const TONES = {
  success: "border-ok bg-ok-soft text-ok",
  error: "border-danger bg-danger-soft text-danger",
  warning: "border-warn bg-warn-soft text-warn",
  info: "border-line bg-surface-muted text-ink",
} as const;

/** Errors are announced at once (`alert`); everything else politely (`status`). */
export function Alert({
  tone = "info",
  children,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cx("rounded-card border px-3 py-2 text-sm", TONES[tone])}
    >
      {children}
    </div>
  );
}
