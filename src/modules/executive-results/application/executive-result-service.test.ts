import { describe, expect, it, vi } from "vitest";
import type { ExecutiveResultRepositoryPort } from "./executive-result-model";
import { ExecutiveResultService } from "./executive-result-service";
describe("ExecutiveResultService", () => {
  it("passes authenticated user and company to the tenant-scoped repository", async () => {
    const repository = {
      read: vi.fn().mockResolvedValue(null),
    } satisfies ExecutiveResultRepositoryPort;
    await new ExecutiveResultService(repository, "viewer").get("company");
    expect(repository.read).toHaveBeenCalledWith("viewer", "company");
  });
});
