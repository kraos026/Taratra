import { describe, expect, it, vi } from "vitest";
import type { PrismaInterviewRepository } from "../infrastructure/prisma-interview-repository";
import { InterviewService } from "./interview-service";

function subject(role = "consultant", hasDiscovery = true) {
  const question = {
    id: "10000000-0000-4000-8000-000000000001",
    code: "finance.email",
    domain: "finance",
    prompt: "Email?",
    answerType: "boolean",
    options: [],
    mandatory: true,
    weight: 1,
    sequence: 1,
    condition: {},
    validation: {},
  };
  const repo = {
    context: vi.fn().mockResolvedValue({ organizationId: "org", role }),
    validatedDiscovery: vi.fn().mockResolvedValue(hasDiscovery ? { id: "discovery" } : null),
    latest: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({
      id: "session",
      companyId: "company",
      lockVersion: 1,
      status: "draft",
    }),
    session: vi.fn().mockResolvedValue({
      id: "session",
      companyId: "company",
      lockVersion: 1,
      status: "in_progress",
    }),
    timeline: vi.fn(),
    questions: vi.fn().mockResolvedValue([question]),
    answers: vi.fn().mockResolvedValue([]),
    discoveryFacts: vi.fn().mockResolvedValue({ industry: "services" }),
    assertLock: vi.fn(),
    answer: vi.fn(),
    skip: vi.fn(),
    decision: vi.fn(),
    removeAnswer: vi.fn(),
    removeIneligibleAnswers: vi.fn(),
    storeProgress: vi.fn(),
    complete: vi.fn(),
    validate: vi.fn(),
  };
  return {
    repo,
    service: new InterviewService(repo as unknown as PrismaInterviewRepository, "user"),
    question,
  };
}

describe("InterviewService", () => {
  it("stores reviewed document provenance in the existing tenant-scoped audit trail without changing answer confidence", async () => {
    const { service, repo, question } = subject();
    const source = {
      fileName: "procedure.txt",
      sha256: "a".repeat(64),
      location: "Ligne 1",
      excerpt: "Revue humaine",
      reviewed: true as const,
    };
    await service.persistAnswer("session", 1, question.id, true, "uncertain", source);
    expect(repo.answer).toHaveBeenCalledWith(
      "org",
      "session",
      question.id,
      "user",
      true,
      "uncertain",
    );
    expect(repo.decision).toHaveBeenCalledWith(
      "org",
      "session",
      question.id,
      "answered",
      "Validated deterministic answer",
      { documentSource: source, provenanceStatus: "USER_REVIEWED_NOT_AUTHENTICATED" },
    );
  });
  it("refuses unreviewed source before any write", async () => {
    const { service, repo, question } = subject();
    await expect(
      service.persistAnswer("session", 1, question.id, true, "confirmed", {
        fileName: "procedure.txt",
        sha256: "a".repeat(64),
        location: "Ligne 1",
        excerpt: "test",
        reviewed: false,
      } as never),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(repo.answer).not.toHaveBeenCalled();
    expect(repo.assertLock).not.toHaveBeenCalled();
  });
  it("keeps document-assisted answers inaccessible to viewers", async () => {
    const { service, repo, question } = subject("viewer");
    await expect(
      service.persistAnswer("session", 1, question.id, true, "confirmed", {
        fileName: "procedure.txt",
        sha256: "a".repeat(64),
        location: "Ligne 1",
        excerpt: "test",
        reviewed: true,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(repo.answer).not.toHaveBeenCalled();
  });
  it.each(["consultant", "viewer"])("forbids final validation for %s", async (role) => {
    const { service, repo } = subject(role);
    await expect(service.validate("session")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(repo.validate).not.toHaveBeenCalled();
  });

  it("requires a completed interview before owner validation", async () => {
    const { service, repo } = subject("owner");
    await expect(service.validate("session")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(repo.validate).not.toHaveBeenCalled();
  });

  it.each(["owner", "admin"])("allows %s to validate a completed interview", async (role) => {
    const { service, repo } = subject(role);
    repo.session.mockResolvedValue({
      id: "session",
      companyId: "company",
      lockVersion: 1,
      status: "completed",
    });
    await service.validate("session");
    expect(repo.validate).toHaveBeenCalledWith("org", "session", "user");
    expect(repo.timeline).toHaveBeenCalledWith("org", "session", "user", "validated");
  });

  it("requires a validated Discovery", async () => {
    await expect(subject("consultant", false).service.start("company")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("prevents viewers from starting interviews", async () => {
    await expect(subject("viewer").service.start("company")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("starts a versioned session from Discovery", async () => {
    const { service, repo } = subject();
    await service.start("company");
    expect(repo.create).toHaveBeenCalledWith("org", "company", "discovery", "user", 1);
  });

  it("loads a validated interview instead of creating a new draft", async () => {
    const { service, repo } = subject();
    repo.latest.mockResolvedValue({ id: "validated", status: "validated", companyId: "company" });
    await service.start("company");
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.session).toHaveBeenCalledWith("org", "validated");
  });

  it("views the latest company interview without creating one", async () => {
    const { service, repo } = subject();
    repo.latest.mockResolvedValue({ id: "existing", status: "validated", companyId: "company" });
    await service.companyView("company");
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.session).toHaveBeenCalledWith("org", "existing");
  });

  it("validates and persists an answer through the engine", async () => {
    const { service, repo, question } = subject();
    await service.answer("session", 1, question.id, true, "confirmed");
    expect(repo.assertLock).toHaveBeenCalledWith("org", "session", 1, question.id);
    expect(repo.answer).toHaveBeenCalledWith(
      "org",
      "session",
      question.id,
      "user",
      true,
      "confirmed",
    );
  });

  it("can persist an answer without refreshing progress in the write transaction", async () => {
    const { service, repo, question } = subject();
    await service.persistAnswer("session", 1, question.id, true, "confirmed");

    expect(repo.answer).toHaveBeenCalledWith(
      "org",
      "session",
      question.id,
      "user",
      true,
      "confirmed",
    );
    expect(repo.removeIneligibleAnswers).not.toHaveBeenCalled();
    expect(repo.storeProgress).not.toHaveBeenCalled();
    expect(repo.answers).not.toHaveBeenCalled();
  });

  it("refreshes progress after the write without recursively loading a full view again", async () => {
    const { service, repo, question } = subject();
    repo.answers.mockResolvedValueOnce([{ questionId: question.id, code: question.code }]);
    repo.answers.mockResolvedValueOnce([{ questionId: question.id, code: question.code }]);

    const view = await service.refreshAnswerProgress("session");

    expect(repo.session).toHaveBeenCalledTimes(1);
    expect(repo.context).toHaveBeenCalledTimes(1);
    expect(repo.answers).toHaveBeenCalledTimes(2);
    expect(repo.storeProgress).toHaveBeenCalledOnce();
    expect(view.session.id).toBe("session");
    expect(view.answers).toEqual([{ questionId: question.id, code: question.code }]);
  });
});
