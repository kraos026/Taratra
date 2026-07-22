import { describe, expect, it, vi } from "vitest";
import type { PrismaAuditRepository } from "../infrastructure/prisma-audit-repository";
import { AuditService } from "./audit-service";
const audit = {
  id: "audit",
  status: "in_progress",
  answers: [],
  questionnaireVersion: { sections: [] },
};
function repository(overrides: Record<string, unknown> = {}) {
  return {
    context: vi.fn().mockResolvedValue({ organizationId: "org", role: "consultant" }),
    create: vi.fn().mockResolvedValue({ id: "audit" }),
    get: vi.fn().mockResolvedValue(audit),
    findQuestion: vi
      .fn()
      .mockResolvedValue({ questionType: "number", optionsJson: null, validationJson: { min: 0 } }),
    upsertAnswer: vi.fn(),
    recalculate: vi.fn().mockResolvedValue({ progressPercentage: 50 }),
    complete: vi.fn().mockResolvedValue({ status: "completed" }),
    validate: vi.fn().mockResolvedValue({ status: "validated" }),
    ...overrides,
  } as unknown as PrismaAuditRepository;
}
describe("AuditService", () => {
  it("creates an audit in resolved organization", async () => {
    const repo = repository();
    await new AuditService(repo, "user").create({
      companyId: "company",
      questionnaireVersionId: "version",
    });
    expect(repo.create).toHaveBeenCalledWith("org", {
      companyId: "company",
      questionnaireVersionId: "version",
    });
  });
  it("validates and records an answer", async () => {
    const repo = repository();
    await new AuditService(repo, "user").answer("audit", "question", 12);
    expect(repo.upsertAnswer).toHaveBeenCalledWith("org", "audit", "question", "user", 12);
    expect(repo.recalculate).toHaveBeenCalled();
  });
  it("completes an audit and surfaces missing required answers", async () => {
    const repo = repository();
    await expect(new AuditService(repo, "user").complete("audit")).resolves.toMatchObject({
      status: "completed",
    });
    const incomplete = repository({ complete: vi.fn().mockResolvedValue(false) });
    await expect(new AuditService(incomplete, "user").complete("audit")).rejects.toMatchObject({
      code: "AUDIT_INCOMPLETE",
    });
  });
  it("reserves validation for owner and admin", async () => {
    const repo = repository();
    await expect(new AuditService(repo, "user").validate("audit")).rejects.toMatchObject({
      code: "AUDIT_FORBIDDEN",
    });
    const admin = repository({
      context: vi.fn().mockResolvedValue({ organizationId: "org", role: "admin" }),
      get: vi.fn().mockResolvedValue({ ...audit, status: "completed" }),
    });
    await expect(new AuditService(admin, "user").validate("audit")).resolves.toMatchObject({
      status: "validated",
    });
  });
  it("keeps viewers read-only", async () => {
    const repo = repository({
      context: vi.fn().mockResolvedValue({ organizationId: "org", role: "viewer" }),
    });
    await expect(
      new AuditService(repo, "user").create({
        companyId: "company",
        questionnaireVersionId: "version",
      }),
    ).rejects.toMatchObject({ code: "AUDIT_FORBIDDEN" });
  });
});
