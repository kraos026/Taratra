import { afterEach, describe, expect, it, vi } from "vitest";
import { waitForAppReadiness } from "./local-certification-support.mjs";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("local certification readiness", () => {
  function mockResponses(lastStatus = 401, lastType = "application/json") {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const login = url.endsWith("/login");
        const last = url.endsWith("/decision-center");
        return new Response("", {
          status: login ? 200 : last ? lastStatus : 401,
          headers: { "content-type": login ? "text/html" : last ? lastType : "application/json" },
        });
      }),
    );
  }

  it("requires all three status and content-type checks to pass", async () => {
    mockResponses();
    await expect(waitForAppReadiness(100)).resolves.toBeUndefined();
  });

  it.each([
    [500, "application/json"],
    [401, "text/html"],
  ])("does not certify a failing final check (%s, %s)", async (status, contentType) => {
    vi.useFakeTimers();
    mockResponses(status, contentType);
    const assertion = expect(waitForAppReadiness(100)).rejects.toThrow("readiness timed out");
    await Promise.all([assertion, vi.advanceTimersByTimeAsync(1000)]);
  });
});
