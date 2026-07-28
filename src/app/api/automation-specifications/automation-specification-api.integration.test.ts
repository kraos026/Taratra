import { beforeEach, describe, expect, it, vi } from "vitest";

const service = {
  generate: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
};

vi.mock("@/modules/automation-specifications/presentation/automation-specification-api", () => ({
  withAutomationSpecificationService: (operation: (value: typeof service) => Promise<unknown>) =>
    operation(service),
}));

import { GET as getSpecification } from "./[id]/route";
import {
  GET as listSpecifications,
  POST as generateSpecification,
} from "../solution-blueprints/[id]/automation-specifications/route";

const id = "10000000-0000-4000-8000-000000000001";

describe("Automation Specification REST API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an invalid Blueprint identifier", async () => {
    const response = await generateSpecification(new Request("http://localhost"), {
      params: Promise.resolve({ id: "invalid" }),
    });
    expect(response.status).toBe(400);
  });

  it("creates a specification through the application service", async () => {
    service.generate.mockResolvedValue({ id: "specification" });
    const response = await generateSpecification(new Request("http://localhost"), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(201);
    expect(service.generate).toHaveBeenCalledWith(id);
  });

  it("returns one tenant-filtered specification DTO", async () => {
    service.get.mockResolvedValue({ specification: { id } });
    const response = await getSpecification(new Request("http://localhost"), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(200);
    expect(service.get).toHaveBeenCalledWith(id);
  });

  it("validates pagination and latest-published filters", async () => {
    service.list.mockResolvedValue({ items: [], total: 0 });
    const response = await listSpecifications(
      new Request("http://localhost?page=2&pageSize=10&latestPublished=true"),
      { params: Promise.resolve({ id }) },
    );
    expect(response.status).toBe(200);
    expect(service.list).toHaveBeenCalledWith(id, {
      page: 2,
      pageSize: 10,
      latestPublished: true,
    });
  });
});
