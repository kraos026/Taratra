import { describe, expect, it, vi } from "vitest";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import { PrismaInterviewRepository } from "./prisma-interview-repository";

const source = {
  fileName: "processus.txt",
  sha256: "a".repeat(64),
  location: "Ligne 1",
  excerpt: "Validation humaine.",
  reviewed: true,
};
function subject(decisions: unknown[], valueJson: unknown = "Validation humaine.") {
  const db = {
    interviewAnswer: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { questionId: "question", valueJson, confidence: "uncertain", skipReason: null },
        ]),
    },
    interviewQuestion: {
      findMany: vi.fn().mockResolvedValue([{ id: "question", code: "process" }]),
    },
    interviewDecision: { findMany: vi.fn().mockResolvedValue(decisions) },
  };
  return { db, repo: new PrismaInterviewRepository(db as unknown as TransactionClient) };
}
describe("document source read-back", () => {
  it("reads saved provenance scoped to the authenticated organization and interview", async () => {
    const { db, repo } = subject([
      { questionId: "question", factsJson: { documentSource: source } },
    ]);
    const answers = await repo.answers("tenant-a", "interview-a");
    expect(answers[0].documentSource).toEqual(source);
    expect(db.interviewDecision.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: "tenant-a",
        interviewSessionId: "interview-a",
        decision: "answered",
        questionId: { in: ["question"] },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { questionId: true, factsJson: true },
    });
  });
  it("does not reuse stale provenance after a manual replacement", async () => {
    const { repo } = subject([
      { questionId: "question", factsJson: {} },
      { questionId: "question", factsJson: { documentSource: source } },
    ]);
    expect((await repo.answers("tenant-a", "interview-a"))[0].documentSource).toBeUndefined();
  });
  it("does not expose malformed provenance or sources for skipped answers", async () => {
    const invalid = subject([
      { questionId: "question", factsJson: { documentSource: { ...source, reviewed: false } } },
    ]);
    expect(
      (await invalid.repo.answers("tenant-a", "interview-a"))[0].documentSource,
    ).toBeUndefined();
    const skipped = subject(
      [{ questionId: "question", factsJson: { documentSource: source } }],
      null,
    );
    expect(
      (await skipped.repo.answers("tenant-a", "interview-a"))[0].documentSource,
    ).toBeUndefined();
  });
});
