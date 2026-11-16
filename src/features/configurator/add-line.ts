import { errorResponse, type AddLineRequest } from "@/contracts/api";

export type AddLineResult =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

const GENERIC = "Something went wrong. The bundle was not added.";

/** Sends the bundle to the server once. The request carries no prices. */
export async function addLine(request: AddLineRequest): Promise<AddLineResult> {
  try {
    const response = await fetch("/api/cart/lines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (response.ok) return { ok: true };
    const body = errorResponse.safeParse(
      await response.json().catch(() => null),
    );
    if (body.success && response.status === 422) {
      return {
        ok: false,
        message: `This bundle is not valid (${body.data.error.message}). Please change it and try again.`,
      };
    }
    return { ok: false, message: GENERIC };
  } catch {
    return { ok: false, message: GENERIC };
  }
}
