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
});
