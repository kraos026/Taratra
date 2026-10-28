/// <reference types="vite/client" />
import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api, internal } from "../../../convex/_generated/api";
import type { DiscoveryPayload } from "@/modules/discovery/application/discovery-schemas";
const modules = import.meta.glob("../../../convex/**/*.ts");
afterEach(() => vi.unstubAllEnvs());
async function setup(industry = "Conseil") {
  vi.stubEnv("OPTIVOS_CONVEX_FRESH_PILOT", "1");
  const t = convexTest(schema, modules),
    owner = t.withIdentity({ subject: "interview-owner" }),
    other = t.withIdentity({ subject: "interview-other" });
  const org = await owner.mutation(api.workspaces.create, { name: "Interview organization" });
  await other.mutation(api.workspaces.create, { name: "Other organization" });
  const company = await owner.mutation(api.companies.create, {
    input: { name: "Interview company" },
  });
  await t.mutation(internal.interviewCatalogue.install, {});
  let discovery = await owner.mutation(api.discovery.start, { companyId: company.id });
  const payloads: DiscoveryPayload[] = [
    { step: "company", industry, countryCode: "MG", employeeCount: 2 },
    {
      step: "business",
      businessModel: "Services",
      growthStage: "Établie",
      revenueAmount: null,
      revenueCurrency: null,
      revenueYear: null,
      offerings: [],
      objectives: [],
      challenges: [],
    },
    { step: "organization", departments: [], roles: [] },
    { step: "software", items: [] },
    { step: "processes", items: [] },
    { step: "review", confirmed: true },
  ];
  for (const payload of payloads)
    discovery = (await owner.mutation(api.discovery.save, {
      id: discovery.id,
      lockVersion: discovery.lockVersion,
      payload,
    }))!;
  await owner.mutation(api.discovery.validate, { id: discovery.id });
  const view = await owner.mutation(api.interviews.start, { companyId: company.id });
  return { t, owner, other, company, org, view };
}
describe("Convex adaptive interview", () => {
  it("requires validated Discovery and a real catalogue", async () => {
    const { owner, company, view, t } = await setup();
    expect((await owner.mutation(api.interviews.start, { companyId: company.id })).session.id).toBe(
      view.session.id,
    );
    expect(view.answers).toEqual([]);
    expect(view.nextQuestion?.code).toBe("company.value_proposition");
    const second = await owner.mutation(api.companies.create, {
      input: { name: "Not understood yet" },
    });
    await expect(owner.mutation(api.interviews.start, { companyId: second.id })).rejects.toThrow(
      "VALIDATION_ERROR",
    );
    expect(await t.mutation(internal.interviewCatalogue.install, {})).toMatchObject({
      alreadyInstalled: true,
      questions: 20,
    });
  });
  it("uses sector conditions and answer branches from the canonical engine", async () => {
    const { owner, view } = await setup("Restaurant");
    expect(view.questions.some((question) => question.code === "restaurant.pos")).toBe(true);
    expect(view.questions.some((question) => question.code === "construction.safety")).toBe(false);
    const question = view.questions.find((question) => question.code === "finance.invoices_email")!;
    const yes = await owner.mutation(api.interviews.answer, {
      id: view.session.id,
      lockVersion: view.session.lockVersion,
      questionId: question.id,
      value: true,
      confidence: "confirmed",
    });
    const invoice = yes.questions.find((question) => question.code === "finance.invoice_volume")!;
    expect(invoice).toBeDefined();
    const volume = await owner.mutation(api.interviews.answer, {
      id: view.session.id,
      lockVersion: yes.session.lockVersion,
      questionId: invoice.id,
      value: 12,
      confidence: "confirmed",
    });
    const back = await owner.mutation(api.interviews.back, {
      id: view.session.id,
      lockVersion: volume.session.lockVersion,
      questionId: question.id,
    });
    const no = await owner.mutation(api.interviews.answer, {
      id: view.session.id,
      lockVersion: back.session.lockVersion,
      questionId: question.id,
      value: false,
      confidence: "confirmed",
    });
    expect(no.questions.some((question) => question.code === "finance.invoice_volume")).toBe(false);
    expect(no.answers.some((answer) => answer.questionId === invoice.id)).toBe(false);
  });
  it("preserves document provenance, confidence and rejects stale edits atomically", async () => {
    const { owner, view, t } = await setup();
    const source = {
      fileName: "contexte.txt",
      sha256: "a".repeat(64),
      location: "Ligne 1",
      excerpt: "Contexte relu pour cet entretien",
      reviewed: true,
    };
    const saved = await owner.mutation(api.interviews.answer, {
      id: view.session.id,
      lockVersion: 1,
      questionId: view.nextQuestion!.id,
      value: "Nous accompagnons les entreprises dans leur activité.",
      confidence: "uncertain",
      documentSource: source,
    });
    expect(saved.answers[0]).toMatchObject({ confidence: "uncertain", documentSource: source });
    await expect(
      owner.mutation(api.interviews.answer, {
        id: view.session.id,
        lockVersion: 1,
        questionId: view.nextQuestion!.id,
        value: "An obsolete change",
        confidence: "confirmed",
      }),
    ).rejects.toThrow("CONFLICT");
    expect((await owner.query(api.interviews.get, { id: view.session.id })).answers).toHaveLength(
      1,
    );
    expect(
      await t.run(async (ctx) => (await ctx.db.query("interview_decisions").collect()).length),
    ).toBe(1);
  });
  it("completes and validates a genuinely answered interview and refuses reopening", async () => {
    const { owner, view } = await setup();
    let current = view;
    await expect(owner.mutation(api.interviews.complete, { id: view.session.id })).rejects.toThrow(
      "VALIDATION_ERROR",
    );
    for (let iteration = 0; current.nextQuestion && iteration < 30; iteration++) {
      const question = current.nextQuestion;
      const value =
        question.answerType === "boolean"
          ? false
          : question.answerType === "number"
            ? 12
            : question.answerType === "multiple_choice"
              ? ["email"]
              : question.answerType === "single_choice"
                ? (question.options as string[])[0]
                : "Nous réalisons ce travail avec une équipe et des outils documentés.";
      current = await owner.mutation(api.interviews.answer, {
        id: current.session.id,
        lockVersion: current.session.lockVersion,
        questionId: question.id,
        value,
        confidence: "confirmed",
      });
    }
    expect(current.nextQuestion).toBeNull();
    expect(current.progress.readyForProcessMapping).toBe(true);
    expect(current.progress.confidencePercentage).toBe(100);
    const completed = await owner.mutation(api.interviews.complete, { id: current.session.id });
    expect(completed.session.status).toBe("completed");
    const validated = await owner.mutation(api.interviews.validate, { id: current.session.id });
    expect(validated.session.status).toBe("validated");
    await expect(
      owner.mutation(api.interviews.complete, { id: current.session.id }),
    ).rejects.toThrow("CONFLICT");
    await expect(
      owner.mutation(api.interviews.back, {
        id: current.session.id,
        lockVersion: validated.session.lockVersion,
        questionId: view.nextQuestion!.id,
      }),
    ).rejects.toThrow("CONFLICT");
  });
  it("rejects anonymous, foreign and viewer writes", async () => {
    const { owner, other, view, t, org } = await setup();
    await expect(t.query(api.interviews.get, { id: view.session.id })).rejects.toThrow(
      "UNAUTHENTICATED",
    );
    await expect(other.query(api.interviews.get, { id: view.session.id })).rejects.toThrow(
      "NOT_FOUND",
    );
    await expect(
      other.mutation(api.interviews.answer, {
        id: view.session.id,
        lockVersion: 1,
        questionId: view.nextQuestion!.id,
        value: "Foreign response",
        confidence: "confirmed",
      }),
    ).rejects.toThrow("NOT_FOUND");
    const member = await t.run((ctx) =>
      ctx.db
        .query("organization_members")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", org.organizationId))
        .unique(),
    );
    await t.run((ctx) => ctx.db.patch(member!._id, { role: "viewer" }));
    await expect(
      owner.mutation(api.interviews.answer, {
        id: view.session.id,
        lockVersion: 1,
        questionId: view.nextQuestion!.id,
        value: "Read only response",
        confidence: "confirmed",
      }),
    ).rejects.toThrow("FORBIDDEN");
  });
});
