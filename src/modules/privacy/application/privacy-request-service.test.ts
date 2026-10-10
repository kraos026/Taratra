import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import {
  createPrivacyRequest,
  listPrivacyRequests,
  privacyRequestInput,
} from "./privacy-request-service";
const id = "00000000-0000-4000-8000-000000000011";
const input = { id, kind: "ACCESS" as const, description: "Sources de mon audit" };
const db = {
  organizationMember: { findFirst: vi.fn() },
  privacyRequest: { findFirst: vi.fn(), findMany: vi.fn() },
  $queryRaw: vi.fn(),
};
const tx = db as unknown as TransactionClient;
describe("self-only privacy requests", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.privacyRequest.findFirst.mockResolvedValue(null);
    db.organizationMember.findFirst.mockResolvedValue({ organizationId: "org-a" });
    db.$queryRaw.mockResolvedValue([{ ...input, status: "RECEIVED" }]);
  });
  it("rejects actor/status/scope injection and invalid text", () => {
    for (const extra of [
      { requesterId: "other" },
      { organizationId: "foreign" },
      { status: "COMPLETED" },
    ])
      expect(privacyRequestInput.safeParse({ ...input, ...extra }).success).toBe(false);
    expect(privacyRequestInput.safeParse({ ...input, description: "    " }).success).toBe(false);
    expect(privacyRequestInput.safeParse({ ...input, description: "x".repeat(1001) }).success).toBe(
      false,
    );
    expect(privacyRequestInput.safeParse({ ...input, kind: "ADMIN" }).success).toBe(false);
  });
  it("derives actor and workspace on server, selects only public fields", async () => {
    await createPrivacyRequest(tx, "user-a", input);
    const [parts, ...values] = db.$queryRaw.mock.calls[0];
    expect(values).toEqual([id, "user-a", "org-a", input.kind, input.description]);
    const sql = parts.join("?");
    expect(sql).toContain("(id, requester_id, organization_id, kind, description)");
    expect(sql.split("RETURNING")[1]).not.toMatch(/requester_id|organization_id/);
  });
  it("lists own requests only and announces pagination boundary", async () => {
    db.privacyRequest.findMany.mockResolvedValue(Array.from({ length: 51 }, () => input));
    const result = await listPrivacyRequests(tx, "user-a");
    expect(db.privacyRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { requesterId: "user-a" }, take: 51 }),
    );
    expect(result.requests).toHaveLength(50);
    expect(result.hasMore).toBe(true);
  });
  it("reuses identical own request id on retry without a write", async () => {
    db.privacyRequest.findFirst.mockResolvedValue(input);
    expect(await createPrivacyRequest(tx, "user-a", input)).toEqual(input);
    expect(db.$queryRaw).not.toHaveBeenCalled();
    expect(db.privacyRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id, requesterId: "user-a" } }),
    );
  });
  it("rejects a changed retry payload", async () => {
    db.privacyRequest.findFirst.mockResolvedValue({ ...input, description: "different" });
    await expect(createPrivacyRequest(tx, "user-a", input)).rejects.toMatchObject({ status: 409 });
  });
  it("does not create without live membership", async () => {
    db.organizationMember.findFirst.mockResolvedValue(null);
    await expect(createPrivacyRequest(tx, "user-a", input)).rejects.toMatchObject({ status: 403 });
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
  it("prevents duplicate open kinds", async () => {
    db.privacyRequest.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "existing" });
    await expect(createPrivacyRequest(tx, "user-a", input)).rejects.toMatchObject({
      code: "OPEN_REQUEST",
    });
  });
  it.each([
    [{ code: "P2002", message: "secret text" }, 409],
    [{ code: "P2010", meta: { code: "23505" }, message: "secret text" }, 409],
    [{ code: "P2039", meta: { driverAdapterError: { cause: { code: "23505" } } } }, 409],
    [new Error("secret text"), 500],
  ])("sanitizes write failures before transaction logging", async (error, status) => {
    db.$queryRaw.mockRejectedValue(error);
    await expect(createPrivacyRequest(tx, "user-a", input)).rejects.toMatchObject({ status });
    await expect(createPrivacyRequest(tx, "user-a", input)).rejects.not.toHaveProperty(
      "message",
      "secret text",
    );
  });
});
