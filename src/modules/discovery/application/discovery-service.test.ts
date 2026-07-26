import { describe, expect, it, vi } from "vitest";
import { DiscoveryService } from "./discovery-service";
import type { PrismaDiscoveryRepository } from "../infrastructure/prisma-discovery-repository";
function service(role = "consultant", answers: string[] = []) {
  const repo = {
    context: vi.fn().mockResolvedValue({ organizationId: "org", role }),
    company: vi.fn().mockResolvedValue({ id: "company" }),
    latest: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: "session", version: 1 }),
    session: vi.fn().mockResolvedValue({
      id: "session",
      status: "completed",
      answers: answers.map((step) => ({ step })),
    }),
    save: vi.fn().mockResolvedValue({ id: "session", lockVersion: 2 }),
    validate: vi.fn().mockResolvedValue({ id: "session", status: "validated" }),
  };
  return {
    repo,
    service: new DiscoveryService(repo as unknown as PrismaDiscoveryRepository, "user"),
  };
}
describe("DiscoveryService", () => {
  it("starts a versioned session", async () => {
    const { service: subject, repo } = service();
    await subject.start("company");
    expect(repo.create).toHaveBeenCalledWith("org", "company", "user", 1);
  });
  it("prevents a viewer from creating", async () =>
    await expect(service("viewer").service.start("company")).rejects.toMatchObject({
      code: "FORBIDDEN",
    }));
  it("delegates autosave with tenant context", async () => {
    const { service: subject, repo } = service();
    await subject.autosave("session", 1, { step: "review", confirmed: true });
    expect(repo.save).toHaveBeenCalledWith("org", "session", "user", 1, {
      step: "review",
      confirmed: true,
    });
  });
  it("rejects incomplete validation", async () =>
    await expect(
      service("consultant", ["company"]).service.validate("session"),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" }));
  it("validates all completed steps", async () => {
    const all = ["company", "business", "organization", "software", "processes", "review"];
    const { service: subject, repo } = service("consultant", all);
    await subject.validate("session");
    expect(repo.validate).toHaveBeenCalledWith("org", "session", "user");
  });
});
