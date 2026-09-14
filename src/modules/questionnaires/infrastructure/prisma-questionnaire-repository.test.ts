import { describe, expect, it, vi } from "vitest";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import { PrismaQuestionnaireRepository } from "./prisma-questionnaire-repository";

describe("PrismaQuestionnaireRepository RLS-safe creation", () => {
  it("also separates version insertion from its RLS-protected readback", async () => {
    const aggregate = vi.fn().mockResolvedValue({ _max: { versionNumber: 2 } });
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const findUniqueOrThrow = vi.fn().mockResolvedValue({ versionNumber: 3 });
    const db = { questionnaireVersion: { aggregate, createMany, findUniqueOrThrow } };
    const result = await new PrismaQuestionnaireRepository(
      db as unknown as TransactionClient,
    ).createVersion("template-a");
    const data = createMany.mock.calls[0][0].data;
    expect(data).toMatchObject({ questionnaireTemplateId: "template-a", versionNumber: 3 });
    expect(data.id).toMatch(/^[a-f0-9-]{36}$/);
    expect(findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: data.id } });
    expect(createMany.mock.invocationCallOrder[0]).toBeLessThan(
      findUniqueOrThrow.mock.invocationCallOrder[0],
    );
    expect(result.versionNumber).toBe(3);
  });
  it("inserts without RETURNING then reads the generated ID in the same transaction", async () => {
    const item = { id: "created", organizationId: "tenant-a" };
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const findUniqueOrThrow = vi.fn().mockResolvedValue(item);
    const db = { questionnaireTemplate: { createMany, findUniqueOrThrow } };
    const result = await new PrismaQuestionnaireRepository(
      db as unknown as TransactionClient,
    ).create("tenant-a", { name: "Synthetic questionnaire", category: "operations" });
    const data = createMany.mock.calls[0][0].data;
    expect(data.id).toMatch(/^[a-f0-9-]{36}$/);
    expect(data).toMatchObject({ organizationId: "tenant-a", isSystem: false });
    expect(findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: data.id } });
    expect(createMany.mock.invocationCallOrder[0]).toBeLessThan(
      findUniqueOrThrow.mock.invocationCallOrder[0],
    );
    expect(result).toBe(item);
  });

  it("does not bypass or read back an insertion rejected by RLS", async () => {
    const error = new Error("RLS denied");
    const createMany = vi.fn().mockRejectedValue(error);
    const findUniqueOrThrow = vi.fn();
    const db = { questionnaireTemplate: { createMany, findUniqueOrThrow } };
    await expect(
      new PrismaQuestionnaireRepository(db as unknown as TransactionClient).create(
        "foreign-tenant",
        { name: "Denied", category: "operations" },
      ),
    ).rejects.toBe(error);
    expect(findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
