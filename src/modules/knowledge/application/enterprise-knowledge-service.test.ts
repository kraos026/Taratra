import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EnterpriseKnowledgeProjector } from "../domain/knowledge-projection";
import type { PrismaKnowledgeRepository } from "../infrastructure/prisma-knowledge-repository";
import { EnterpriseKnowledgeService } from "./enterprise-knowledge-service";

const discovery = {
  session: { id: "discovery-id", version: 2, validatedAt: new Date("2026-01-01") },
  profile: {
    companyId: "company",
    industry: "services",
    countryCode: "FR",
    employeeCount: 10,
    businessModel: "b2b",
    growthStage: "growth",
  },
  departments: [],
  roles: [],
  software: [],
  processes: [],
};
const interview = {
  session: { id: "interview-id", version: 3, validatedAt: new Date("2026-01-02") },
  answers: [],
};
const projection = {
  sources: [
    {
      key: "discovery",
      type: "discovery" as const,
      sourceId: "discovery-id",
      version: 2,
      validatedAt: new Date("2026-01-01"),
    },
  ],
  nodes: [],
  facts: [],
  relationships: [],
};

describe("EnterpriseKnowledgeService", () => {
  const projector = { project: vi.fn().mockReturnValue(projection) };

  beforeEach(() => vi.clearAllMocks());

  it.each(["owner", "admin", "consultant"])("allows %s to build", async (role) => {
    const repository = repositoryFor(role);
    await new EnterpriseKnowledgeService(repository, "user", asProjector(projector)).build(
      "company",
    );
    expect(repository.persist).toHaveBeenCalledWith("org", "company", "user", projection);
  });

  it("rejects viewers before accessing company data", async () => {
    const repository = repositoryFor("viewer");
    await expect(
      new EnterpriseKnowledgeService(repository, "user", asProjector(projector)).build("company"),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    expect(repository.companyExists).not.toHaveBeenCalled();
  });

  it("rejects users without organization membership", async () => {
    const repository = repositoryFor("owner");
    repository.context.mockResolvedValue(null);
    await expect(
      new EnterpriseKnowledgeService(repository, "user", asProjector(projector)).build("company"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("does not expose a company outside the authenticated tenant", async () => {
    const repository = repositoryFor("owner");
    repository.companyExists.mockResolvedValue(false);
    await expect(
      new EnterpriseKnowledgeService(repository, "user", asProjector(projector)).build("other"),
    ).rejects.toMatchObject({ code: "COMPANY_NOT_FOUND", status: 404 });
    expect(repository.inputs).not.toHaveBeenCalled();
  });

  it("requires validated Discovery input", async () => {
    const repository = repositoryFor("consultant");
    repository.inputs.mockResolvedValue({ discovery: null, interview: null });
    await expect(
      new EnterpriseKnowledgeService(repository, "user", asProjector(projector)).build("company"),
    ).rejects.toMatchObject({ code: "DISCOVERY_REQUIRED", status: 409 });
    expect(projector.project).not.toHaveBeenCalled();
  });

  it("projects the validated Interview when available", async () => {
    const repository = repositoryFor("owner");
    repository.inputs.mockResolvedValue({ discovery, interview });
    await new EnterpriseKnowledgeService(repository, "user", asProjector(projector)).build(
      "company",
    );
    expect(projector.project).toHaveBeenCalledWith(discovery, interview);
  });

  it("preserves the optional Interview contract", async () => {
    const repository = repositoryFor("owner");
    await new EnterpriseKnowledgeService(repository, "user", asProjector(projector)).build(
      "company",
    );
    expect(projector.project).toHaveBeenCalledWith(discovery, null);
  });

  it("returns repository idempotency metadata unchanged", async () => {
    const repository = repositoryFor("owner");
    repository.persist.mockResolvedValue({
      snapshot: { id: "snapshot", companyId: "company", status: "ready", version: 1 },
      created: false,
    });
    await expect(
      new EnterpriseKnowledgeService(repository, "user", asProjector(projector)).build("company"),
    ).resolves.toMatchObject({ snapshot: { id: "snapshot" }, created: false });
  });
});

function repositoryFor(role: string) {
  return {
    context: vi.fn().mockResolvedValue({ organizationId: "org", role }),
    companyExists: vi.fn().mockResolvedValue(true),
    inputs: vi.fn().mockResolvedValue({ discovery, interview: null }),
    persist: vi.fn().mockResolvedValue({
      snapshot: { id: "snapshot", companyId: "company", status: "ready", version: 1 },
      created: true,
    }),
  } as unknown as PrismaKnowledgeRepository & {
    context: ReturnType<typeof vi.fn>;
    companyExists: ReturnType<typeof vi.fn>;
    inputs: ReturnType<typeof vi.fn>;
    persist: ReturnType<typeof vi.fn>;
  };
}

function asProjector(value: { project: ReturnType<typeof vi.fn> }): EnterpriseKnowledgeProjector {
  return value as unknown as EnterpriseKnowledgeProjector;
}
