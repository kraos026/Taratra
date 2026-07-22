import { describe, expect, it, vi } from "vitest";
import type { PrismaQuestionnaireRepository } from "../infrastructure/prisma-questionnaire-repository";
import { QuestionnaireService } from "./questionnaire-service";
function repository(overrides: Record<string, unknown> = {}) {
  return {
    context: vi.fn().mockResolvedValue({ organizationId: "org", role: "owner" }),
    getVersion: vi
      .fn()
      .mockResolvedValue({ id: "version", status: "draft", template: { isSystem: false } }),
    get: vi.fn().mockResolvedValue({ id: "template", isSystem: false }),
    duplicate: vi.fn().mockResolvedValue({ id: "copy" }),
    publish: vi.fn().mockResolvedValue({ id: "version", status: "published" }),
    archive: vi.fn(),
    ...overrides,
  } as unknown as PrismaQuestionnaireRepository;
}
describe("QuestionnaireService", () => {
  it("duplicates a version", async () => {
    const repo = repository();
    await expect(
      new QuestionnaireService(repo, "user").duplicateVersion("version"),
    ).resolves.toMatchObject({ id: "copy" });
    expect(repo.duplicate).toHaveBeenCalledWith("version");
  });
  it("publishes only drafts", async () => {
    const repo = repository();
    await new QuestionnaireService(repo, "user").publishVersion("version");
    expect(repo.publish).toHaveBeenCalled();
    const immutable = repository({
      getVersion: vi.fn().mockResolvedValue({ status: "published", template: { isSystem: false } }),
    });
    await expect(
      new QuestionnaireService(immutable, "user").publishVersion("version"),
    ).rejects.toMatchObject({ code: "QUESTIONNAIRE_IMMUTABLE" });
  });
  it("blocks consultants from administration", async () => {
    const repo = repository({
      context: vi.fn().mockResolvedValue({ organizationId: "org", role: "consultant" }),
    });
    await expect(
      new QuestionnaireService(repo, "user").create({ name: "Audit", category: "ops" }),
    ).rejects.toMatchObject({ code: "QUESTIONNAIRE_FORBIDDEN" });
  });
});
