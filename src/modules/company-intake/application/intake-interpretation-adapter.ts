import type {
  AIInterpretationRequest,
  AIInterpretationResult,
  AIProvider,
} from "../../../brain-evaluation/ai-interpretation-gateway";
import { AIInterpretationGateway } from "../../../brain-evaluation/ai-interpretation-gateway";
import type { IntakeSession, IntakeSource } from "../domain/company-intake";

export interface IntakeInterpretationResult {
  readonly source: IntakeSource;
  readonly sessionId: string;
  readonly interpretation: AIInterpretationResult;
}

/** Adapter boundary: raw intake enters E3; no candidate is promoted to a FACT here. */
export class IntakeInterpretationAdapter {
  private readonly gateway: AIInterpretationGateway;

  constructor(provider: AIProvider) {
    this.gateway = new AIInterpretationGateway(provider);
  }

  async interpret(
    source: IntakeSource,
    session: IntakeSession,
  ): Promise<IntakeInterpretationResult> {
    if (source.tenantId !== session.tenantId || source.companyId !== session.companyId)
      throw new Error("Source and session scope mismatch");
    if (!source.rawText?.trim()) throw new Error("Source has no interpretable raw content");
    const request: AIInterpretationRequest = {
      requestId: `${session.sessionId}:${source.sourceId}`,
      tenantId: session.tenantId,
      sourceId: source.sourceId,
      sourceType: source.sourceType,
      sourceText: source.rawText,
      task: "CORPORATE_INTAKE_INTERPRETATION",
      schemaVersion: "company-intake-v1",
      traceContext: {
        companyId: source.companyId,
        sourceId: source.sourceId,
        sessionId: session.sessionId,
        ...(source.actorId ? { actorId: source.actorId } : {}),
      },
    };
    return Object.freeze({
      source,
      sessionId: session.sessionId,
      interpretation: await this.gateway.interpret(request),
    });
  }
}
