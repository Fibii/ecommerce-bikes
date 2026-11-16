import { isCompatible, type Accessory } from "@/domain/accessory";
import { err, ok, type Result } from "@/domain/result";
import type { Catalog, CatalogReader } from "./ports";

export type CatalogDeps = { readonly catalog: CatalogReader };

export type UnknownBike = {
  readonly code: "unknown-bike";
  readonly bikeId: string;
};

/** Every bike and accessory the shop sells. */
export function getCatalog({ catalog }: CatalogDeps): Promise<Catalog> {
  return catalog.read();
}

/** The accessories that fit the bike, in catalog order. */
export async function getCompatibleAccessories(
  { catalog }: CatalogDeps,
  bikeId: string,
): Promise<Result<readonly Accessory[], UnknownBike>> {
  const { bikes, accessories } = await catalog.read();
  const bike = bikes.find((candidate) => candidate.id === bikeId);
  if (bike === undefined) return err({ code: "unknown-bike", bikeId });
  return ok(accessories.filter((accessory) => isCompatible(accessory, bike)));
}
