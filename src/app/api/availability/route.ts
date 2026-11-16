import { NextResponse, type NextRequest } from "next/server";
import { availabilityQuery } from "@/contracts/api";
import { bikeId } from "@/domain/bike";
import { getApp } from "@/server/composition";
import { errorResponse } from "@/server/http";

export async function GET(request: NextRequest) {
  const query = availabilityQuery.safeParse(
    request.nextUrl.searchParams.get("ids") ?? "",
  );
  if (!query.success) {
    return errorResponse({
      code: "invalid-request",
      issues: query.error.issues,
    });
  }

  // `bikeId` and `accessoryId` check the same thing; either brands a ProductId.
  const productIds = [...new Set(query.data)].map((value) => {
    const parsed = bikeId(value);
    if (!parsed.ok) throw new Error("the contract accepted an invalid id");
    return parsed.value;
  });

  const availability = await getApp().getAvailability(productIds);
  if (!availability.ok) return errorResponse(availability.error);
  return NextResponse.json({ items: availability.value });
}
