import { describe, expect, it } from "vitest";
import { preserveDiscoveryDetails, readDiscoveryAnswers } from "./discovery-answer-draft";

describe("Discovery answers after refresh", () => {
  it("restores software and process fields separately from their shared items API key", () => {
    const draft = readDiscoveryAnswers({
      answers: [
        {
          step: "software",
          valueJson: { step: "software", items: [{ name: "Planning", purpose: "Reservations" }] },
        },
        {
          step: "processes",
          valueJson: {
            step: "processes",
            items: [
              { name: "Facturation", categoryCode: "finance", painPoints: ["Double saisie"] },
            ],
          },
        },
      ],
    });
    expect(draft.software).toBe("Planning");
    expect(draft.processes).toBe("Facturation");
    expect(draft.processCategory).toBe("finance");
    expect(draft.painPoints).toBe("Double saisie");
  });
  it("restores explicit priority and offering controls, not fallback values", () => {
    const draft = readDiscoveryAnswers({
      answers: [
        {
          step: "business",
          valueJson: {
            offerings: [{ name: "Produit", type: "product" }],
            objectives: [{ title: "Fiabilité", priority: 5 }],
            challenges: [{ title: "Retards", severity: 4 }],
          },
        },
      ],
    });
    expect(draft.offeringType).toBe("product");
    expect(draft.objectivePriority).toBe("5");
    expect(draft.challengeSeverity).toBe("4");
  });
});

describe("compact form persistence preserves existing evidence", () => {
  const previous = {
    step: "processes",
    valueJson: {
      step: "processes",
      items: [
        {
          name: "Facturation",
          categoryCode: "finance",
          volume: 130,
          manualHoursMonth: 24,
          frequency: "daily",
          painPoints: ["Saisie"],
        },
        {
          name: "Support",
          categoryCode: "support",
          volume: 12,
          manualHoursMonth: 8,
          frequency: "weekly",
          painPoints: ["Attente"],
        },
      ],
    },
  };
  const draft = readDiscoveryAnswers({ answers: [previous] });
  const candidate = {
    step: "processes",
    items: previous.valueJson.items.map((item) => ({
      name: item.name,
      categoryCode: "finance",
      volume: null,
      manualHoursMonth: null,
      frequency: null,
      painPoints: ["Saisie", "Attente"],
    })),
  };
  it("round-trips unchanged heterogeneous processes without inventing uniform values", () => {
    expect(preserveDiscoveryDetails(previous, draft, candidate)).toEqual(previous.valueJson);
  });
  it("preserves measurements when only the pain points are edited", () => {
    const result = preserveDiscoveryDetails(
      previous,
      { ...draft, painPoints: "Validation" },
      {
        ...candidate,
        items: candidate.items.map((item) => ({ ...item, painPoints: ["Validation"] })),
      },
    );
    expect(result.items).toEqual(
      previous.valueJson.items.map((item) => ({ ...item, painPoints: ["Validation"] })),
    );
  });
  it("does not resurrect a deliberately removed process", () => {
    expect(
      preserveDiscoveryDetails(
        previous,
        { ...draft, processes: "Facturation" },
        { ...candidate, items: candidate.items.slice(0, 1) },
      ).items,
    ).toEqual(previous.valueJson.items.slice(0, 1));
  });
  it("retains financial assumptions when editing unrelated business copy", () => {
    const business = {
      step: "business",
      valueJson: {
        step: "business",
        businessModel: "Services",
        revenueAmount: 10000,
        revenueCurrency: "EUR",
        revenueYear: 2025,
        objectives: [
          { title: "Fiabilité", priority: 5, description: "Contrôle", targetDate: "2026-12-01" },
        ],
      },
    };
    const current = readDiscoveryAnswers({ answers: [business] });
    expect(
      preserveDiscoveryDetails(
        business,
        { ...current, businessModel: "Abonnements" },
        {
          ...business.valueJson,
          businessModel: "Abonnements",
          objectives: [{ title: "Fiabilité", priority: 3, description: null, targetDate: null }],
        },
      ),
    ).toEqual({ ...business.valueJson, businessModel: "Abonnements" });
  });
  it("keeps original role linkage and headcounts", () => {
    const organization = {
      step: "organization",
      valueJson: {
        roles: [
          {
            title: "Direction",
            headcount: 3,
            departmentClientId: "d1",
            responsibilities: ["Approbation"],
          },
        ],
      },
    };
    const current = readDiscoveryAnswers({ answers: [organization] });
    expect(
      preserveDiscoveryDetails(organization, current, {
        roles: [
          { title: "Direction", headcount: 1, departmentClientId: null, responsibilities: [] },
        ],
      }),
    ).toEqual(organization.valueJson);
  });
  it("does not change a new session payload", () =>
    expect(preserveDiscoveryDetails(undefined, draft, candidate)).toBe(candidate));
});
