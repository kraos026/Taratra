import { describe, expect, it, vi } from "vitest";
import type { PrismaRecommendationPortfolioRepository } from "../infrastructure/prisma-recommendation-portfolio-repository";
import { RecommendationPortfolioValidationError } from "./recommendation-errors";
import { RecommendationPortfolioService } from "./recommendation-service";

type RepositoryMock = Pick<
  PrismaRecommendationPortfolioRepository,
  "context" | "transitionReadiness" | "transition" | "detail"
>;

const repo = (overrides = {}) =>
  ({
    context: vi.fn().mockResolvedValue({ organizationId: "org-1", role: "owner" }),
    transitionReadiness: vi.fn().mockResolvedValue({
      snapshot: { id: "portfolio-1" },
      validationErrorCount: 0,
      recommendationCount: 1,
      recommendationsTraceable: true,
    }),
    transition: vi.fn().mockResolvedValue({ id: "portfolio-1", status: "published" }),
    detail: vi.fn(),
    ...overrides,
  }) as unknown as RepositoryMock;

describe("RecommendationPortfolioService transitions", () => {
  it("publishes from transition readiness without hydrating full detail inside the transition path", async () => {
    const repository = repo();
    const service = new RecommendationPortfolioService(repository as never, "user-1");

    await expect(service.publish("portfolio-1", 1)).resolves.toMatchObject({
      id: "portfolio-1",
      status: "published",
    });

    expect(repository.transitionReadiness).toHaveBeenCalledWith("org-1", "portfolio-1");
    expect(repository.detail).not.toHaveBeenCalled();
    expect(repository.transition).toHaveBeenCalledWith("org-1", "portfolio-1", 1, "published");
  });

  it("keeps traceability validation before publish", async () => {
    const repository = repo({
      transitionReadiness: vi.fn().mockResolvedValue({
        snapshot: { id: "portfolio-1" },
        validationErrorCount: 0,
        recommendationCount: 1,
        recommendationsTraceable: false,
      }),
    });
    const service = new RecommendationPortfolioService(repository as never, "user-1");

    await expect(service.publish("portfolio-1", 1)).rejects.toBeInstanceOf(
      RecommendationPortfolioValidationError,
    );
    expect(repository.transition).not.toHaveBeenCalled();
  });

  it("validates from compact readiness instead of full recommendation detail", async () => {
    const repository = repo({ transition: vi.fn().mockResolvedValue({ status: "validated" }) });
    const service = new RecommendationPortfolioService(repository as never, "user-1");

    await expect(service.validate("portfolio-1", 1)).resolves.toMatchObject({
      status: "validated",
    });

    expect(repository.detail).not.toHaveBeenCalled();
    expect(repository.transition).toHaveBeenCalledWith("org-1", "portfolio-1", 1, "validated");
  });
});
