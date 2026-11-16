import { Badge } from "@/ui/badge";
import { Skeleton } from "@/ui/skeleton";
import { stockLabel, type StockState } from "./stock";

export function StockBadge({ state }: { state: StockState }) {
  const label = stockLabel(state);
  if (label === undefined) return <Skeleton label="Loading stock" />;
  return <Badge tone={label.tone}>{label.text}</Badge>;
}
