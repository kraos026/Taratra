import { describe, expect, it } from "vitest";
import config from "../next.config";

describe("application security headers", () => {
  it("prevents framing, MIME sniffing and unnecessary browser permissions", async () => {
    const entries = await config.headers?.();
    const headers = entries?.find((entry) => entry.source === "/:path*")?.headers ?? [];
    const map = Object.fromEntries(
      headers.map((header) => [header.key.toLowerCase(), header.value]),
    );
    expect(map["x-content-type-options"]).toBe("nosniff");
    expect(map["x-frame-options"]).toBe("DENY");
    expect(map["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(map["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(map["permissions-policy"]).toContain("microphone=()");
  });
});
