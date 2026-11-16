/** @jest-environment node */
import { GET } from "./route";

jest.mock("next/server", () => ({ connection: async () => undefined }));

describe("GET /api/health", () => {
  it("answers 200 with an ok status", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});
