import { describe, expect, it, vi } from "vitest";
import { SolutionBlueprintService } from "./solution-blueprint-service";
import type { SolutionBlueprintRepository } from "./solution-blueprint-repository";

const repository = (
  role: "owner" | "admin" | "consultant" | "viewer",
  overrides: Record<string, unknown> = {},
) =>
  ({
    context: vi.fn().mockResolvedValue({
      organizationId: "organization",
      role,
    }),
    prepareRebuild: vi.fn(),
    ...overrides,
  }) as unknown as SolutionBlueprintRepository;

describe("SolutionBlueprintService permissions and concurrency", () => {
  it("forbids a viewer from generating a blueprint", async () => {
    const service = new SolutionBlueprintService(repository("viewer"), "user");

    await expect(service.generate("recommendation")).rejects.toMatchObject({
      code: "SOLUTION_BLUEPRINT_FORBIDDEN",
      status: 403,
    });
  });

  it("forbids a consultant from publishing a blueprint", async () => {
    const service = new SolutionBlueprintService(repository("consultant"), "user");

    await expect(service.publish("blueprint", 1)).rejects.toMatchObject({
      code: "SOLUTION_BLUEPRINT_FORBIDDEN",
      status: 403,
    });
  });

  it("returns HTTP 409 semantics when optimistic locking detects a stale rebuild", async () => {
    const service = new SolutionBlueprintService(
      repository("admin", {
        prepareRebuild: vi.fn().mockResolvedValue({
          id: "blueprint",
          recommendationId: "recommendation",
          status: "draft",
          lockVersion: 2,
        }),
      }),
      "user",
    );

    await expect(service.rebuild("blueprint", 1)).rejects.toMatchObject({
      code: "SOLUTION_BLUEPRINT_CONFLICT",
      status: 409,
    });
  });

  it("refuses validation when a published catalog rule failed", async () => {
    const service = new SolutionBlueprintService(
      repository("consultant", {
        detail: vi.fn().mockResolvedValue({
          blueprint: {
            id: "blueprint",
            recommendationId: "recommendation",
            status: "draft",
            lockVersion: 1,
          },
          evidence: [{ id: "evidence" }],
          validations: [
            {
              code: "catalog_rule",
              severity: "error",
              message: "failed",
              passed: false,
            },
          ],
        }),
      }),
      "user",
    );

    await expect(service.validate("blueprint", 1)).rejects.toMatchObject({
      code: "SOLUTION_BLUEPRINT_INVALID",
      status: 422,
    });
  });

  it("publishes through the aggregate and repository transition", async () => {
    const transition = vi.fn().mockResolvedValue({ status: "published" });
    const service = new SolutionBlueprintService(
      repository("admin", {
        detail: vi.fn().mockResolvedValue({
          blueprint: {
            id: "blueprint",
            recommendationId: "recommendation",
            status: "validated",
            lockVersion: 2,
          },
          evidence: [{ id: "evidence" }],
          validations: [
            {
              code: "catalog_rule",
              severity: "error",
              message: "passed",
              passed: true,
            },
          ],
        }),
        transition,
      }),
      "user",
    );

    await service.publish("blueprint", 2);
    expect(transition).toHaveBeenCalledWith("organization", "blueprint", 2, "published");
  });
});
