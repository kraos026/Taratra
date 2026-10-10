import { describe, expect, it, vi } from "vitest";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import { authorizePrivacyOperator, updateOperatorPrivacyRequest } from "./privacy-operator-service";

const input = {
  id: "11111111-1111-4111-8111-111111111111",
  expectedRevision: 0,
  status: "IN_REVIEW" as const,
  response: "Demande examinée.",
};
function dbMock(rows: unknown[][]) {
  return {
    $queryRaw: vi.fn().mockImplementation(async () => rows.shift() ?? []),
    $executeRaw: vi.fn().mockResolvedValue(1),
  };
}
describe("privacy operator service", () => {
  it("denies missing live grant/session before any read", async () => {
    const db = dbMock([[]]);
    await expect(
      authorizePrivacyOperator(db as unknown as TransactionClient, input.id, input.id),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
  it("accepts only affirmative authorization result", async () => {
    await expect(
      authorizePrivacyOperator(
        dbMock([[{ allowed: true }]]) as unknown as TransactionClient,
        input.id,
        input.id,
      ),
    ).resolves.toBeUndefined();
  });
  it("denies missing request without mutation", async () => {
    const db = dbMock([[]]);
    await expect(
      updateOperatorPrivacyRequest(db as unknown as TransactionClient, input.id, input),
    ).rejects.toMatchObject({ status: 404 });
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
  it("rejects stale revision without writing history", async () => {
    const db = dbMock([[{ ...input, revision: 4, publicResponse: "Different" }]]);
    await expect(
      updateOperatorPrivacyRequest(db as unknown as TransactionClient, input.id, input),
    ).rejects.toMatchObject({ status: 409 });
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
  it("returns exact actor-owned retry without another event", async () => {
    const db = dbMock([
      [{ ...input, revision: 1, publicResponse: input.response }],
      [{ id: input.id }],
    ]);
    await expect(
      updateOperatorPrivacyRequest(db as unknown as TransactionClient, input.id, input),
    ).resolves.toMatchObject({ revision: 1 });
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
  it("rejects retry lacking an actor-owned event", async () => {
    const db = dbMock([[{ ...input, revision: 1, publicResponse: input.response }], []]);
    await expect(
      updateOperatorPrivacyRequest(db as unknown as TransactionClient, input.id, input),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("rejects terminal edits even with correct revision", async () => {
    const db = dbMock([[{ ...input, status: "COMPLETED", revision: 0 }]]);
    await expect(
      updateOperatorPrivacyRequest(db as unknown as TransactionClient, input.id, input),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
  it("records event before returning the atomic updated version", async () => {
    const db = dbMock([
      [{ ...input, status: "RECEIVED", revision: 0 }],
      [{ ...input, revision: 1 }],
    ]);
    await expect(
      updateOperatorPrivacyRequest(db as unknown as TransactionClient, input.id, input),
    ).resolves.toMatchObject({ revision: 1 });
    expect(db.$executeRaw).toHaveBeenCalledOnce();
  });
});
