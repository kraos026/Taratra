import type {
  CompanyIntake,
  IntakeReadinessAssessment,
  IntakeSource,
} from "../domain/company-intake";

export class IntakeReadinessAssessmentService {
  assess(intake: CompanyIntake, sources: readonly IntakeSource[]): IntakeReadinessAssessment {
    const criticalGaps: string[] = [];
    const minimumContextAvailable =
      Boolean(intake.displayName || intake.legalName) && Boolean(intake.industry);
    if (!minimumContextAvailable) criticalGaps.push("company context");
    const sourceAvailable = sources.length > 0;
    if (!sourceAvailable) criticalGaps.push("at least one source");
    const sourceDiversity = new Set(sources.map((source) => source.sourceType)).size;
    const unprocessedInputs = sources.filter(
      (source) => source.processingStatus === "PENDING",
    ).length;
    if (unprocessedInputs) criticalGaps.push("unprocessed inputs");
    const contradictions: string[] = [];
    const status =
      !minimumContextAvailable || !sourceAvailable
        ? "NOT_READY"
        : unprocessedInputs > 0
          ? "READY_FOR_INTERPRETATION"
          : sourceDiversity >= 2
            ? "READY_FOR_BRAIN"
            : "PARTIALLY_READY";
    return Object.freeze({
      status,
      minimumContextAvailable,
      sourceAvailable,
      sourceDiversity,
      criticalGaps: Object.freeze(criticalGaps),
      contradictions: Object.freeze(contradictions),
      unprocessedInputs,
    });
  }
}
