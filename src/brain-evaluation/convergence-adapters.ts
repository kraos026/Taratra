import {
  Claim,
  Confidence,
  Evidence,
  ReasoningTrace,
  type BrainModule,
  type EvidenceFreshness,
  type EvidenceSourceType,
} from "./brain-contracts";
import {
  Process,
  ProcessModel,
  ProcessStep,
  Dependency,
  ControlPoint,
  Handoff,
} from "./process-causal";

export class ConfidenceAdapter {
  static toBrain(percent: number): number {
    if (!Number.isFinite(percent) || percent < 0 || percent > 100)
      throw new Error("Production confidence must be between 0 and 100");
    return round(percent / 100);
  }
  static toProduction(normalized: number): number {
    if (!Number.isFinite(normalized) || normalized < 0 || normalized > 1)
      throw new Error("Brain confidence must be between 0 and 1");
    return Math.round(normalized * 100);
  }
}
export type IdentityNamespace =
  "production" | "snapshot" | "process" | "evidence" | "claim" | "opportunity";
export class BrainIdentityMap {
  private readonly map = new Map<string, string>();
  bind(namespace: IdentityNamespace, productionId: string, brainId: string): void {
    const key = `${namespace}:${productionId}`;
    if (!productionId || !brainId) throw new Error("Identity values are required");
    const existing = this.map.get(key);
    if (existing && existing !== brainId) throw new Error("Identity mapping conflict");
    this.map.set(key, brainId);
  }
  resolve(namespace: IdentityNamespace, productionId: string): string {
    const value = this.map.get(`${namespace}:${productionId}`);
    if (!value) throw new Error(`Missing identity mapping for ${namespace}:${productionId}`);
    return value;
  }
  has(namespace: IdentityNamespace, productionId: string): boolean {
    return this.map.has(`${namespace}:${productionId}`);
  }
  snapshot(): Readonly<Record<string, string>> {
    return Object.freeze(Object.fromEntries(this.map));
  }
}
export interface ProductionProvenance {
  sourceId: string;
  sourceType: string;
  sourceVersion?: number;
  sourceModule?: string;
  capturedAt: Date;
  parentSourceId?: string;
}
export class ProvenanceAdapter {
  toTrace(provenance: readonly ProductionProvenance[], targetId: string): ReasoningTrace {
    const nodes: Record<string, string> = { [targetId]: "Brain derived artifact" };
    const edges = provenance.map((p, index) => {
      const id = `provenance:${p.sourceId}:${index}`;
      nodes[id] = `${p.sourceType}${p.sourceVersion === undefined ? "" : ` v${p.sourceVersion}`}`;
      return {
        fromId: id,
        toId: targetId,
        relationship: "supports",
        rationale: `Source ${p.sourceId} lineage preserved`,
      };
    });
    return ReasoningTrace.create(nodes, edges);
  }
}
export interface EnterpriseEvidenceRecord {
  id: string;
  sourceType: EvidenceSourceType;
  sourceReference: string;
  sourceModule?: BrainModule;
  capturedAt: Date;
  freshness?: EvidenceFreshness;
  reliability: number;
  content: string;
  structuredValue?: unknown;
  provenance: Readonly<Record<string, unknown>>;
  tenantId?: string;
  companyId?: string;
  tags?: readonly string[];
  claim?: { id: string; statement: string; kind: "FACT" | "INFERENCE" | "HYPOTHESIS" | "UNKNOWN" };
}
export class EnterpriseEvidenceAdapter {
  toBrain(records: readonly EnterpriseEvidenceRecord[]): {
    evidence: readonly Evidence[];
    claims: readonly Claim[];
  } {
    const evidence = records.map((r) =>
      Evidence.create({
        evidenceId: r.id,
        sourceType: r.sourceType,
        sourceReference: r.sourceReference,
        sourceModule: r.sourceModule ?? "enterprise_knowledge",
        capturedAt: r.capturedAt,
        freshness: r.freshness ?? "UNKNOWN",
        reliability: r.reliability,
        content: r.content,
        structuredValue: r.structuredValue,
        provenance: r.provenance,
        tenantId: r.tenantId,
        companyId: r.companyId,
        tags: r.tags,
      }),
    );
    const claims = records
      .filter((r) => r.claim)
      .map((r) =>
        Claim.create({
          claimId: r.claim!.id,
          kind: r.claim!.kind,
          statement: r.claim!.statement,
          supportingEvidenceIds: [r.id],
          confidence: Confidence.create(
            ConfidenceAdapter.toBrain(r.reliability * 100),
            {
              supportingEvidenceCount: 1,
              averageSourceReliability: r.reliability,
              sourceAgreement: 1,
              freshness: 1,
              directness: r.claim!.kind === "FACT" ? 1 : 0.6,
              contradictionPenalty: 0,
              missingDataPenalty: 0,
            },
            "Adapted from production evidence reliability",
          ),
          rationale: "Claim created from explicit Enterprise evidence",
          createdByModule: "enterprise_knowledge",
          createdAt: r.capturedAt,
          lastEvaluatedAt: r.capturedAt,
        }),
      );
    return Object.freeze({ evidence: Object.freeze(evidence), claims: Object.freeze(claims) });
  }
}
export interface PublishedProcessMap {
  id: string;
  lineageId?: string;
  version: number;
  status: "published";
  name: string;
  nodes: readonly {
    id: string;
    type:
      | "process"
      | "step"
      | "decision"
      | "document"
      | "actor"
      | "system"
      | "event"
      | "input"
      | "output";
    name: string;
    actor?: string;
    system?: string;
    processingMinutes?: number;
    waitingMinutes?: number;
    input?: string;
    output?: string;
    errorRate?: number;
    reworkRate?: number;
    volume?: number;
    decisionPoint?: boolean;
    exceptionFrequency?: number;
  }[];
  edges?: readonly { id: string; from: string; to: string; type: string }[];
  controls?: readonly {
    id: string;
    stepId: string;
    type:
      | "APPROVAL"
      | "VALIDATION"
      | "RECONCILIATION"
      | "ACCESS_CHECK"
      | "THRESHOLD_CHECK"
      | "QUALITY_REVIEW";
    requiredHuman?: boolean;
    intentional?: boolean;
  }[];
}
export class ProcessMapAdapter {
  toBrain(map: PublishedProcessMap): ProcessModel {
    if (map.status !== "published") throw new Error("Only published Process Maps can be adapted");
    const steps = map.nodes
      .filter((n) => n.type === "step" || n.type === "decision")
      .map((n) =>
        ProcessStep.create({
          stepId: n.id,
          name: n.name,
          actor: n.actor,
          system: n.system,
          processingMinutes: n.processingMinutes,
          waitingMinutes: n.waitingMinutes,
          input: n.input,
          output: n.output,
          errorRate: n.errorRate,
          reworkRate: n.reworkRate,
          volume: n.volume,
          decisionPoint: n.decisionPoint,
          exceptionFrequency: n.exceptionFrequency,
        }),
      );
    const process = Process.create({ processId: map.id, name: map.name, steps });
    const dependencies = (map.edges ?? [])
      .filter((e) => e.type === "depends_on" || e.type === "triggers")
      .map((e) =>
        Dependency.create({ dependencyId: e.id, kind: "STEP", fromId: e.from, toId: e.to }),
      );
    const controls = (map.controls ?? []).map((c) =>
      ControlPoint.create({
        controlId: c.id,
        stepId: c.stepId,
        type: c.type,
        requiredHuman: c.requiredHuman,
        intentional: c.intentional,
      }),
    );
    const handoffs = (map.edges ?? [])
      .filter((e) => e.type === "transfers")
      .map((e) => Handoff.create({ handoffId: e.id, fromStepId: e.from, toStepId: e.to }));
    return ProcessModel.create({ process, handoffs, dependencies, controls });
  }
}
export interface DualRunComparison {
  productionResult: unknown;
  brainResult: unknown;
  differences: readonly {
    path: string;
    production: unknown;
    brain: unknown;
    kind: "ADDITIVE" | "CONFLICT" | "MISSING_IN_BRAIN" | "MISSING_IN_PRODUCTION";
  }[];
  ownership: "PRODUCTION";
}
export class DualRunHarness {
  compare(
    productionResult: unknown,
    brainResult: unknown,
    differences: DualRunComparison["differences"] = [],
  ): DualRunComparison {
    return Object.freeze({
      productionResult,
      brainResult,
      differences: Object.freeze([...differences]),
      ownership: "PRODUCTION",
    });
  }
}
function round(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
