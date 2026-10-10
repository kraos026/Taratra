import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ exportProfile: vi.fn(), denied: false }));
vi.mock("@/modules/companies/presentation/company-api", () => ({
  validationError: () => new Response("invalid", { status: 400 }),
  withCompanyService: async (
    _action: string,
    operation: (service: unknown) => Promise<Response>,
  ) =>
    mocks.denied
      ? new Response("denied", { status: 401 })
      : operation({ exportProfile: mocks.exportProfile }),
}));
import { GET } from "./route";

const id = "00000000-0000-4000-8000-000000000001";
describe("company profile download", () => {
  beforeEach(() => {
    mocks.denied = false;
    mocks.exportProfile.mockReset();
  });
  it("downloads a private JSON profile using a validated filename", async () => {
    mocks.exportProfile.mockResolvedValue({ scope: "company_profile_only" });
    const response = await GET(new Request("https://local.invalid"), {
      params: Promise.resolve({ id }),
    });
    expect(mocks.exportProfile).toHaveBeenCalledWith(id);
    expect(response.headers.get("Content-Disposition")).toBe(
      `attachment; filename="optivos-profil-${id}.json"`,
    );
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await response.json()).toEqual({ scope: "company_profile_only" });
  });
  it("rejects invalid identifiers without calling the export", async () => {
    const response = await GET(new Request("https://local.invalid"), {
      params: Promise.resolve({ id: "../bad\r\n" }),
    });
    expect(response.status).toBe(400);
    expect(mocks.exportProfile).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("never caches an unauthenticated error", async () => {
    mocks.denied = true;
    const response = await GET(new Request("https://local.invalid"), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(401);
    expect(mocks.exportProfile).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
});
