import { describe, expect, it, vi } from "vitest";
import type { PrismaSolutionBlueprintRepository } from "../infrastructure/prisma-solution-blueprint-repository";
import { SolutionBlueprintService } from "./solution-blueprint-service";

const repository = (
  role: "owner" | "admin" | "consultant" | "viewer",
  overrides: Record<string, unknown> = {},
) =>
  ({
    context: vi.fn().mockResolvedValue({
      organizationId: "organization",
      role,
    }),
    snapshot: vi.fn(),
    ...overrides,
  }) as unknown as PrismaSolutionBlueprintRepository;

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
        snapshot: vi.fn().mockResolvedValue({
          id: "blueprint",
          recommendationId: "recommendation",
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
});
