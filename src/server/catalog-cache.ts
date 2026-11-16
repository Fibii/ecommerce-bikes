import { cacheLife, cacheTag } from "next/cache";
import { getApp } from "./composition";

/** The tag that `POST /api/revalidate` invalidates. */
export const CATALOG_TAG = "catalog";

/**
 * The catalog, cached for an hour and tagged (A4). It lives here and not in
 * `application/` because `cacheLife` and `cacheTag` are Next.js imports.
 */
export async function getCachedCatalog() {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);
  return getApp().getCatalog();
}
