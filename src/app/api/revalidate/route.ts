import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { CATALOG_TAG } from "@/server/catalog-cache";
import { errorResponse } from "@/server/http";

export const SECRET_HEADER = "x-revalidate-secret";

/**
 * Marks the cached catalog stale; the next visit serves it and refreshes it in
 * the background. Guarded by REVALIDATE_SECRET: without that variable set, no
 * request is accepted.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  const given = request.headers.get(SECRET_HEADER);
  if (!secret || given === null || !sameSecret(given, secret)) {
    return errorResponse({ code: "unauthorized" });
  }
  revalidateTag(CATALOG_TAG, "max");
  return new Response(null, { status: 204 });
}

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
