import { describe, expect, it } from "vitest";
import { GET, POST } from "./route";

describe("pilot feedback API validation", () => {
  it("rejects an invalid company id before authentication or database access", async () => {
    const response = await GET(new Request("http://localhost/api/pilot-feedback?companyId=bad"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("rejects malformed JSON with a controlled 400", async () => {
    const response = await POST(
      new Request("http://localhost/api/pilot-feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });
});
