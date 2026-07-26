export type ScoreTone = "red" | "orange" | "blue" | "green";
export type ReportPriority = "quick_win" | "strategic" | "nice_to_have" | "low_priority";
export type ReportScore = {
  categoryId: string | null;
  category: string;
  score: number;
  total: number;
  percentage: number;
  tone: ScoreTone;
  ruleCount: number;
  recommendationCount: number;
};
export type ReportRecommendation = {
  id: string;
  code: string;
  title: string;
  category: string;
  priority: ReportPriority;
  roiPercentage: number;
  hoursMonth: number | null;
  hoursYear: number;
  annualSavings: number;
  implementationCost: number;
  paybackMonths: number | null;
  status: string;
};
export type AuditReport = {
  audit: { id: string; status: string; date: string; maturity: string | null };
  organization: { id: string; name: string };
  company: {
    id: string;
    name: string;
    discovery?: {
      industry: string | null;
      countryCode: string | null;
      businessModel: string | null;
      growthStage: string | null;
    };
  };
  scores: { global: ReportScore; categories: ReportScore[] };
  recommendations: ReportRecommendation[];
  roi: {
    currency: string | null;
    annualSavings: number;
    hoursMonth: number | null;
    hoursYear: number;
    implementationCost: number;
    paybackMonths: number | null;
    quickWins: number;
    strategic: number;
  };
  summary: { strengths: string[]; risks: string[]; topRecommendations: string[]; roiText: string };
  charts: {
    domainScores: { name: string; score: number }[];
    hoursByCategory: { name: string; hours: number }[];
    priorityDistribution: { name: string; value: number }[];
    roiByRecommendation: { name: string; roi: number }[];
  };
};
export function scoreTone(score: number): ScoreTone {
  return score < 40 ? "red" : score < 70 ? "orange" : score < 90 ? "blue" : "green";
}
