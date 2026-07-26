import {
  scoreTone,
  type AuditReport,
  type ReportPriority,
  type ReportRecommendation,
} from "../domain/audit-report";
export type ReportSource = {
  audit: {
    id: string;
    status: string;
    createdAt: Date;
    organization: { id: string; name: string };
    company: {
      id: string;
      name: string;
      discoveryProfile?: {
        industry: string | null;
        countryCode: string | null;
        businessModel: string | null;
        growthStage: string | null;
      } | null;
    };
    answers: { valueJson: unknown; question: { code: string } }[];
    scores: {
      categoryId: string | null;
      score: unknown;
      total: unknown;
      percentage: unknown;
      category: { name: string } | null;
    }[];
    ruleMatches: { matched: boolean; rule: { categoryId: string } }[];
    recommendations: {
      id: string;
      priority: string;
      estimatedHoursYear: unknown;
      estimatedSavingsYear: unknown;
      roiPercentage: unknown;
      implementationCost: unknown;
      paybackMonths: unknown;
      metadataJson: unknown;
      recommendation: {
        code: string;
        title: string;
        categoryId: string;
        category: { name: string };
        active: boolean;
      };
    }[];
  };
};
const priorityOrder: Record<ReportPriority, number> = {
  quick_win: 0,
  strategic: 1,
  nice_to_have: 2,
  low_priority: 3,
};
export class ReportBuilder {
  build(source: ReportSource): AuditReport {
    const a = source.audit;
    const maturity = a.answers.find(
      (x) => x.question.code === "general.digital_maturity",
    )?.valueJson;
    const recs: ReportRecommendation[] = a.recommendations
      .filter((x) => x.recommendation.active)
      .map((x) => {
        const meta =
          typeof x.metadataJson === "object" && x.metadataJson !== null
            ? (x.metadataJson as Record<string, unknown>)
            : {};
        return {
          id: x.id,
          code: x.recommendation.code,
          title: x.recommendation.title,
          category: x.recommendation.category.name,
          priority: x.priority as ReportPriority,
          roiPercentage: Number(x.roiPercentage),
          hoursMonth: typeof meta.hoursMonth === "number" ? meta.hoursMonth : null,
          hoursYear: Number(x.estimatedHoursYear),
          annualSavings: Number(x.estimatedSavingsYear),
          implementationCost: Number(x.implementationCost),
          paybackMonths: x.paybackMonths === null ? null : Number(x.paybackMonths),
          status: "recommended",
        };
      })
      .sort(
        (x, y) =>
          priorityOrder[x.priority] - priorityOrder[y.priority] ||
          y.roiPercentage - x.roiPercentage ||
          x.code.localeCompare(y.code),
      );
    const categories = a.scores
      .filter((x) => x.category)
      .map((x) => ({
        categoryId: x.categoryId,
        category: x.category!.name,
        score: Number(x.score),
        total: Number(x.total),
        percentage: Number(x.percentage),
        tone: scoreTone(Number(x.percentage)),
        ruleCount: a.ruleMatches.filter((m) => m.rule.categoryId === x.categoryId).length,
        recommendationCount: recs.filter((r) => r.category === x.category!.name).length,
      }));
    const globalSource = a.scores.find((x) => x.categoryId === null);
    const global = {
      categoryId: null,
      category: "Global",
      score: Number(globalSource?.score ?? 0),
      total: Number(globalSource?.total ?? 0),
      percentage: Number(globalSource?.percentage ?? 0),
      tone: scoreTone(Number(globalSource?.percentage ?? 0)),
      ruleCount: a.ruleMatches.length,
      recommendationCount: recs.length,
    };
    const annualSavings = recs.reduce((n, r) => n + r.annualSavings, 0),
      hoursYear = recs.reduce((n, r) => n + r.hoursYear, 0),
      implementationCost = recs.reduce((n, r) => n + r.implementationCost, 0);
    const monthValues = recs.map((r) => r.hoursMonth);
    const hoursMonth = monthValues.some((v) => v === null)
      ? null
      : monthValues.reduce<number>((n, v) => n + (v ?? 0), 0);
    const paybacks = recs.flatMap((r) => (r.paybackMonths === null ? [] : [r.paybackMonths]));
    const paybackMonths = paybacks.length ? Math.min(...paybacks) : null;
    const strengths = categories
      .filter((x) => x.percentage >= 70)
      .sort((x, y) => y.percentage - x.percentage)
      .map((x) => x.category);
    const risks = categories
      .filter((x) => x.percentage < 70)
      .sort((x, y) => x.percentage - y.percentage)
      .map((x) => x.category);
    const top = recs.slice(0, 5).map((x) => x.title);
    const firstMetadata = a.recommendations[0]?.metadataJson;
    const currency =
      typeof firstMetadata === "object" &&
      firstMetadata !== null &&
      typeof (firstMetadata as Record<string, unknown>).currency === "string"
        ? ((firstMetadata as Record<string, unknown>).currency as string)
        : null;
    const distribution = (["quick_win", "strategic", "nice_to_have", "low_priority"] as const).map(
      (p) => ({ name: p, value: recs.filter((r) => r.priority === p).length }),
    );
    return {
      audit: {
        id: a.id,
        status: a.status,
        date: a.createdAt.toISOString(),
        maturity: typeof maturity === "string" ? maturity : null,
      },
      organization: a.organization,
      company: {
        id: a.company.id,
        name: a.company.name,
        ...(a.company.discoveryProfile ? { discovery: a.company.discoveryProfile } : {}),
      },
      scores: { global, categories },
      recommendations: recs,
      roi: {
        currency,
        annualSavings,
        hoursMonth,
        hoursYear,
        implementationCost,
        paybackMonths,
        quickWins: recs.filter((r) => r.priority === "quick_win").length,
        strategic: recs.filter((r) => r.priority === "strategic").length,
      },
      summary: {
        strengths,
        risks,
        topRecommendations: top,
        roiText: `${annualSavings.toLocaleString("fr-FR")} économisés par an pour ${implementationCost.toLocaleString("fr-FR")} de mise en œuvre.`,
      },
      charts: {
        domainScores: categories.map((x) => ({ name: x.category, score: x.percentage })),
        hoursByCategory: categories.map((c) => ({
          name: c.category,
          hours: recs.filter((r) => r.category === c.category).reduce((n, r) => n + r.hoursYear, 0),
        })),
        priorityDistribution: distribution,
        roiByRecommendation: recs.map((r) => ({ name: r.title, roi: r.roiPercentage })),
      },
    };
  }
}
