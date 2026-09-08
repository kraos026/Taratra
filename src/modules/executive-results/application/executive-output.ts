import { customerOutputText } from "@/shared/domain/output-template";
import type { ExecutiveAuditResult } from "./executive-result-model";

/** Read-only compatibility for previously published descriptions. No persisted values change. */
export function safeExecutiveOutput(result: ExecutiveAuditResult): ExecutiveAuditResult {
  const text = customerOutputText;
  return {
    ...result,
    findings: result.findings.map((item) => ({
      ...item,
      title: text(item.title),
      description: text(item.description),
      impact: text(item.impact),
    })),
    opportunities: result.opportunities.map((item) => ({
      ...item,
      title: text(item.title),
      problem: text(item.problem),
    })),
    recommendations: result.recommendations.map((item) => ({
      ...item,
      title: text(item.title),
      description: text(item.description),
      action: text(item.action),
    })),
    process: result.process ? { ...result.process, name: text(result.process.name) } : null,
    roi: result.roi
      ? {
          ...result.roi,
          evaluations: result.roi.evaluations.map((item) => ({ ...item, title: text(item.title) })),
        }
      : null,
  };
}
