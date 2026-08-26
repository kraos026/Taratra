import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AutomationSpecificationInput } from "../domain/automation-specification";
import { generateAutomationSpecification } from "./automation-specification-api";

const mocks = vi.hoisted(() => ({
  withAuthenticatedDatabase: vi.fn(),
  getClaims: vi.fn(),
  context: vi.fn(),
  input: vi.fn(),
  persistPrepared: vi.fn(),
  detail: vi.fn(),
  preparePlan: vi.fn(),
}));

vi.mock("@/infrastructure/database/with-authenticated-database", () => ({
  withAuthenticatedDatabase: mocks.withAuthenticatedDatabase,
}));

vi.mock("@/infrastructure/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getClaims: mocks.getClaims,
    },
  }),
}));

vi.mock("../infrastructure/prisma-automation-specification-repository", async () => {
  const actual = await vi.importActual<
    typeof import("../infrastructure/prisma-automation-specification-repository")
  >("../infrastructure/prisma-automation-specification-repository");
  return {
    ...actual,
    prepareAutomationSpecificationPersistencePlan: mocks.preparePlan,
    PrismaAutomationSpecificationRepository: vi.fn().mockImplementation(function repository() {
      return {
        context: mocks.context,
        input: mocks.input,
        persistPrepared: mocks.persistPrepared,
        detail: mocks.detail,
      };
    }),
  };
});

const input: AutomationSpecificationInput = {
  blueprint: {
    id: "blueprint",
    organizationId: "organization",
    versionNumber: 1,
    status: "published",
    name: "Blueprint",
    objective: "Automate",
    components: [],
    capabilities: [],
    connectors: [],
    constraints: [],
    inputs: [],
    outputs: [],
    topology: [],
  },
  rules: [
    {
      id: "validation",
      code: "source_published",
      version: 1,
      ruleType: "validation",
      operator: "source_published",
      severity: "error",
      description: "Source is published",
      published: true,
    },
  ],
};

describe("automation-specification-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "user" } }, error: null });
    mocks.context.mockResolvedValue({ organizationId: "organization", role: "consultant" });
    mocks.input.mockResolvedValue(input);
    mocks.preparePlan.mockReturnValue({
      specificationHeader: {
        id: "specification",
        organizationId: "organization",
        solutionBlueprintId: "blueprint",
      },
      elementRows: [],
      provenanceRows: [],
      validationRows: [],
    });
    mocks.persistPrepared.mockResolvedValue({
      id: "specification",
      organizationId: "organization",
      solutionBlueprintId: "blueprint",
      status: "draft",
      lockVersion: 1,
      versionNumber: 1,
      isLatestVersion: true,
    });
    mocks.detail.mockResolvedValue({
      specification: { id: "specification", status: "draft" },
      validations: [],
    });
    mocks.withAuthenticatedDatabase.mockImplementation((_userId, operation) => operation({}));
  });

  it("generates outside the write transaction and uses a bounded module write timeout", async () => {
    await generateAutomationSpecification("blueprint");

    expect(mocks.withAuthenticatedDatabase).toHaveBeenCalledTimes(3);
    expect(mocks.preparePlan).toHaveBeenCalledOnce();
    expect(mocks.persistPrepared).toHaveBeenCalledOnce();
    expect(mocks.withAuthenticatedDatabase.mock.calls[1][2]).toEqual({ timeout: 10_000 });
    expect(mocks.detail).toHaveBeenCalledWith("organization", "specification");
  });
});
