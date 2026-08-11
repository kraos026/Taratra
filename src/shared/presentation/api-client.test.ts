import { describe, expect, it } from "vitest";
import { PublicApiError, readApiResponse } from "./api-client";

describe("readApiResponse", () => {
  it("returns data from a valid success envelope", async () => {
    const response = Response.json({ success: true, data: { id: "company-1" } });
    await expect(readApiResponse(response, "fallback")).resolves.toEqual({ id: "company-1" });
  });

  it("uses the public JSON error without exposing transport parsing errors", async () => {
    const response = Response.json(
      { success: false, error: { code: "FORBIDDEN", message: "Accès interdit" } },
      { status: 403 },
    );
    await expect(readApiResponse(response, "fallback")).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Accès interdit",
      status: 403,
    });
  });

  it.each([
    new Response("", { status: 500 }),
    new Response("<html>error</html>", { status: 500, headers: { "content-type": "text/html" } }),
    new Response("{", { status: 500, headers: { "content-type": "application/json" } }),
  ])("turns an invalid server response into a controlled product error", async (response) => {
    await expect(readApiResponse(response, "Service indisponible")).rejects.toEqual(
      new PublicApiError("Service indisponible", 500, "INVALID_API_RESPONSE"),
    );
  });
});
