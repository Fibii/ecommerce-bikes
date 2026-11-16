import { formatMoney } from "./format";

type PriceProps = {
  gross: number;
  net: number;
  /** Shown after the gross amount, such as "incl. 19 % VAT". */
  note: string;
};

/** Gross first, with the net amount beside it, smaller (U6). */
export function Price({ gross, net, note }: PriceProps) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2">
      <span className="font-semibold">{formatMoney(gross)}</span>
      <span className="text-xs text-ink-muted">{note}</span>
      <span className="text-xs text-ink-muted">{formatMoney(net)} net</span>
    </p>
  );
}
