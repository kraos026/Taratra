import { describe, expect, it } from "vitest";
import { ReportBuilder, type ReportSource } from "./report-builder";
function source(): ReportSource {
  return {
    audit: {
      id: "a",
      status: "completed",
      createdAt: new Date("2026-07-22T00:00:00Z"),
      organization: { id: "o", name: "Org" },
      company: { id: "c", name: "Company" },
      answers: [{ valueJson: "avancé", question: { code: "general.digital_maturity" } }],
      scores: [
        { categoryId: null, score: 8, total: 10, percentage: 80, category: null },
        {
          categoryId: "sales",
          score: 2,
          total: 10,
          percentage: 20,
          category: { name: "Commercial" },
        },
        {
          categoryId: "finance",
          score: 9,
          total: 10,
          percentage: 90,
          category: { name: "Finance" },
        },
      ],
      ruleMatches: [
        { matched: true, rule: { categoryId: "sales" } },
        { matched: false, rule: { categoryId: "finance" } },
      ],
      recommendations: [
        {
          id: "ar1",
          priority: "quick_win",
          estimatedHoursYear: 120,
          estimatedSavingsYear: 6000,
          roiPercentage: 200,
          implementationCost: 2000,
          paybackMonths: 4,
          metadataJson: { hoursMonth: 10, currency: "EUR" },
          recommendation: {
            code: "CRM",
            title: "Installer un CRM",
            categoryId: "sales",
            category: { name: "Commercial" },
            active: true,
          },
        },
      ],
    },
  };
}
describe("ReportBuilder", () => {
  it("builds the complete report from stored results", () => {
    const report = new ReportBuilder().build(source());
    expect(report.scores.global.percentage).toBe(80);
    expect(report.audit.maturity).toBe("avancé");
    expect(report.roi).toMatchObject({
      currency: "EUR",
      annualSavings: 6000,
      hoursMonth: 10,
      hoursYear: 120,
      quickWins: 1,
    });
    expect(report.recommendations).toHaveLength(1);
  });
  it("creates deterministic strengths risks and top five", () => {
    const summary = new ReportBuilder().build(source()).summary;
    expect(summary.strengths).toEqual(["Finance"]);
    expect(summary.risks).toEqual(["Commercial"]);
    expect(summary.topRecommendations).toEqual(["Installer un CRM"]);
  });
  it("creates all four chart datasets", () => {
    const charts = new ReportBuilder().build(source()).charts;
    expect(Object.keys(charts)).toEqual([
      "domainScores",
      "hoursByCategory",
      "priorityDistribution",
      "roiByRecommendation",
    ]);
  });
  it("is JSON serializable for export", () =>
    expect(() => JSON.stringify(new ReportBuilder().build(source()))).not.toThrow());
  it("returns an empty state without recommendations", () => {
    const fixture = source();
    fixture.audit.recommendations = [];
    expect(new ReportBuilder().build(fixture).recommendations).toEqual([]);
  });
});
