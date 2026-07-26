import { describe, expect, it } from "vitest";
import { EnterpriseKnowledgeProjector, type DiscoveryKnowledgeInput } from "./knowledge-projection";

const discovery: DiscoveryKnowledgeInput = {
  session: { id: "discovery", version: 2, validatedAt: new Date("2026-01-01") },
  profile: {
    companyId: "company",
    industry: "Restaurant",
    countryCode: "FR",
    employeeCount: 12,
    businessModel: "B2C",
    growthStage: "growth",
  },
  departments: [{ id: "finance", name: "Finance", headcount: 2 }],
  roles: [{ id: "accountant", departmentId: "finance", title: "Comptable", headcount: 1 }],
  software: [{ id: "odoo", name: "Odoo", purpose: "ERP", criticality: 5 }],
  processes: [
    {
      id: "invoice",
      name: "Invoice Processing",
      frequency: "Monthly",
      manualHoursMonth: 20,
    },
  ],
};

describe("EnterpriseKnowledgeProjector", () => {
  const projector = new EnterpriseKnowledgeProjector();

  it("normalizes Discovery entities without losing canonical references", () => {
    const projection = projector.project(discovery, null);
    expect(projection.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "software:odoo",
          canonicalEntityId: "odoo",
          canonicalEntityType: "software",
        }),
      ]),
    );
    expect(projection.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "process:invoice.frequency",
          value: "Monthly",
          sourceRecordId: "invoice",
        }),
      ]),
    );
  });

  it("preserves Interview evidence and independent confidence", () => {
    const projection = projector.project(discovery, {
      session: { id: "interview", version: 1, validatedAt: new Date("2026-01-02") },
      answers: [
        {
          id: "answer",
          code: "finance.invoice_software",
          domain: "finance",
          value: "Odoo",
          confidence: "uncertain",
        },
      ],
    });
    expect(projection.facts).toContainEqual(
      expect.objectContaining({
        key: "interview.finance.invoice_software",
        confidence: 50,
        sourceKey: "interview",
        evidenceType: "validated_answer",
      }),
    );
  });

  it("creates explainable relationships", () => {
    expect(projector.project(discovery, null).relationships).toContainEqual({
      fromNodeKey: "department:finance",
      toNodeKey: "role:accountant",
      type: "has_role",
      confidence: 100,
    });
  });
});
