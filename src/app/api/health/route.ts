import { connection } from "next/server";

/** Liveness probe for the container HEALTHCHECK: answers 200 while the server runs. */
export async function GET() {
  // Opt out of build-time prerendering so the answer comes from the running server.
  await connection();
  return Response.json({ status: "ok" });
}
