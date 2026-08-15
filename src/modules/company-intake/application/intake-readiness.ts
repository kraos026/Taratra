import type {
  CompanyIntake,
  IntakeReadinessAssessment,
  IntakeSource,
} from "../domain/company-intake";

export interface ProductionIntakeState {
  readonly company: { readonly id: string; readonly organizationId: string };
  readonly discovery: {
    readonly exists: boolean;
    readonly validated: boolean;
  };
  readonly interviews: {
    readonly exists: boolean;
    readonly completed: boolean;
  };
  readonly knowledgeSnapshot: {
    readonly exists: boolean;
    readonly validated: boolean;
  };
  readonly processMap: {
    readonly exists: boolean;
    readonly published: boolean;
  };
  readonly unresolvedGaps?: readonly string[];
}

export interface ProductionReadinessAssessment extends IntakeReadinessAssessment {
  readonly companyId: string;
  readonly tenantId: string;
}

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

  /**
   * Evaluates canonical production state. No CompanyIntake, IntakeSession or
   * in-memory repository is consulted, so readiness cannot create a second
   * lifecycle.
   */
  assessProduction(state: ProductionIntakeState, tenantId: string): ProductionReadinessAssessment {
    const gaps = new Set(state.unresolvedGaps ?? []);
    if (!state.discovery.exists) gaps.add("discovery");
    if (!state.discovery.validated) gaps.add("validated discovery");
    if (!state.interviews.exists) gaps.add("interview");
    if (!state.interviews.completed) gaps.add("completed interview");
    if (!state.knowledgeSnapshot.exists) gaps.add("knowledge snapshot");
    if (!state.knowledgeSnapshot.validated) gaps.add("validated knowledge snapshot");
    if (!state.processMap.exists) gaps.add("process map");
    if (!state.processMap.published) gaps.add("published process map");

    const criticalGaps = Object.freeze([...gaps]);
    const minimumContextAvailable = Boolean(state.company.id && state.company.organizationId);
    const sourceAvailable = state.knowledgeSnapshot.exists;
    const readyForBrain = minimumContextAvailable && criticalGaps.length === 0;
    const status: IntakeReadinessAssessment["status"] = !minimumContextAvailable
      ? "NOT_READY"
      : readyForBrain
        ? "READY_FOR_BRAIN"
        : "PARTIALLY_READY";

    return Object.freeze({
      companyId: state.company.id,
      tenantId,
      status,
      minimumContextAvailable,
      sourceAvailable,
      sourceDiversity: sourceAvailable ? 1 : 0,
      criticalGaps,
      contradictions: Object.freeze([]),
      unprocessedInputs: 0,
    });
  }
}
