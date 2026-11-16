/** @jest-environment node */
import { revalidateTag } from "next/cache";
import { NextRequest } from "next/server";
import { POST } from "./route";

jest.mock("next/cache", () => ({
  revalidateTag: jest.fn(),
  cacheLife: jest.fn(),
  cacheTag: jest.fn(),
}));

const post = (secret?: string) =>
  POST(
    new NextRequest("http://localhost/api/revalidate", {
      method: "POST",
      headers: secret === undefined ? {} : { "x-revalidate-secret": secret },
    }),
  );

describe("POST /api/revalidate", () => {
  beforeEach(() => {
    jest.mocked(revalidateTag).mockClear();
    process.env.REVALIDATE_SECRET = "s3cret";
  });
  afterAll(() => delete process.env.REVALIDATE_SECRET);

  it("marks the catalog stale for the right secret and answers 204", async () => {
    const response = await post("s3cret");

    expect(response.status).toBe(204);
    expect(revalidateTag).toHaveBeenCalledWith("catalog", "max");
  });

  it.each([
    ["missing", undefined],
    ["wrong", "nope"],
  ])(
    "answers 401 for a %s secret and revalidates nothing",
    async (_name, secret) => {
      const response = await post(secret);

      expect(response.status).toBe(401);
      expect((await response.json()).error.code).toBe("unauthorized");
      expect(revalidateTag).not.toHaveBeenCalled();
    },
  );

  it("accepts nothing when no secret is configured", async () => {
    delete process.env.REVALIDATE_SECRET;

    expect((await post("")).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
