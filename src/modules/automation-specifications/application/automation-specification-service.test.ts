import { describe, expect, it, vi } from "vitest";
import { AutomationSpecificationService } from "./automation-specification-service";
import type { AutomationSpecificationRepository } from "./automation-specification-repository";

const repository = (role: string, overrides: Record<string, unknown> = {}) =>
  ({
    context: vi.fn().mockResolvedValue({ organizationId: "organization", role }),
    ...overrides,
  }) as unknown as AutomationSpecificationRepository;

const validation = {
  ruleCode: "valid",
  ruleVersion: 1,
  severity: "error" as const,
  passed: true,
  targetLocalId: null,
  message: "valid",
  details: {},
};

describe("AutomationSpecificationService", () => {
  it("forbids viewers from generating", async () => {
    await expect(
      new AutomationSpecificationService(repository("viewer"), "user").generate("blueprint"),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("forbids consultants from publishing", async () => {
    await expect(
      new AutomationSpecificationService(repository("consultant"), "user").publish("spec", 1),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("requires one published Blueprint input", async () => {
    const service = new AutomationSpecificationService(
      repository("consultant", { input: vi.fn().mockResolvedValue(null) }),
      "user",
    );
    await expect(service.generate("blueprint")).rejects.toMatchObject({ status: 422 });
  });

  it("maps stale aggregate locks to HTTP 409 semantics", async () => {
    const service = new AutomationSpecificationService(
      repository("consultant", {
        prepareRebuild: vi.fn().mockResolvedValue({
          id: "spec",
          organizationId: "organization",
          solutionBlueprintId: "blueprint",
          status: "draft",
          lockVersion: 2,
          versionNumber: 1,
          isLatestVersion: true,
        }),
      }),
      "user",
    );
    await expect(service.rebuild("spec", 1)).rejects.toMatchObject({ status: 409 });
  });

  it("publishes only through the aggregate and repository transition", async () => {
    const transition = vi.fn().mockResolvedValue({ status: "published" });
    const service = new AutomationSpecificationService(
      repository("admin", {
        detail: vi.fn().mockResolvedValue({
          specification: {
            id: "spec",
            organizationId: "organization",
            solutionBlueprintId: "blueprint",
            status: "validated",
            lockVersion: 2,
            versionNumber: 1,
            isLatestVersion: true,
          },
          validations: [validation],
        }),
        transition,
      }),
      "user",
    );
    await service.publish("spec", 2);
    expect(transition).toHaveBeenCalledWith("organization", "spec", 2, "published");
  });

  it("restricts archive to owner and admin", async () => {
    const detail = vi.fn().mockResolvedValue({
      specification: {
        id: "spec",
        organizationId: "organization",
        solutionBlueprintId: "blueprint",
        status: "published",
        lockVersion: 3,
        versionNumber: 1,
        isLatestVersion: true,
      },
      validations: [validation],
    });
    await expect(
      new AutomationSpecificationService(repository("consultant", { detail }), "user").archive(
        "spec",
        3,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
});
