import type {
  AssistedAuditAction,
  AssistedAuditArtifactReference,
  AssistedAuditReadModel,
  AssistedAuditStage,
} from "../application/assisted-audit-model";

export interface AuditCommandRequest {
  url: string;
  init: RequestInit;
}

export type AuditActionPresentation =
  | { kind: "navigate"; label: string; description: string; href: string }
  | { kind: "command"; label: string; description: string; request: AuditCommandRequest }
  | { kind: "unavailable"; label: string; description: string };

const copy: Record<AssistedAuditAction, { label: string; description: string }> = {
  START_DISCOVERY: {
    label: "Start company discovery",
    description: "Tell AutomateX how your company is organized and operates.",
  },
  CONTINUE_DISCOVERY: {
    label: "Continue company discovery",
    description: "Complete the remaining company information.",
  },
  VALIDATE_DISCOVERY: {
    label: "Confirm company information",
    description: "Confirm that the information collected about your company is correct.",
  },
  START_INTERVIEW: {
    label: "Start the interview",
    description: "Answer a short set of questions about your daily operations.",
  },
  CONTINUE_INTERVIEW: {
    label: "Continue the interview",
    description: "Complete the remaining operational questions.",
  },
  VALIDATE_INTERVIEW: {
    label: "Confirm the interview",
    description: "Approve the completed answers before analysis begins.",
  },
  BUILD_KNOWLEDGE: {
    label: "Build company knowledge",
    description: "Organize your confirmed information into a reliable company model.",
  },
  BUILD_PROCESS_MAP: {
    label: "Create process maps",
    description: "Turn company knowledge into structured business processes.",
  },
  SELECT_PROCESS_MAP: {
    label: "Choose a process",
    description: "Choose the process you want AutomateX to analyze first.",
  },
  VALIDATE_PROCESS_MAP: {
    label: "Confirm the process map",
    description: "Review and validate the selected business process.",
  },
  PUBLISH_PROCESS_MAP: {
    label: "Approve the process map",
    description: "Approve this process so the business analysis can begin.",
  },
  GENERATE_ANALYSIS: {
    label: "Run business analysis",
    description: "Analyze the approved process for friction, risk and improvement potential.",
  },
  VALIDATE_ANALYSIS: {
    label: "Review the analysis",
    description: "Confirm the findings produced from your business process.",
  },
  PUBLISH_ANALYSIS: {
    label: "Approve the analysis",
    description: "Approve the findings before opportunity detection begins.",
  },
  GENERATE_AI_OPPORTUNITIES: {
    label: "Find AI opportunities",
    description: "Identify where AI could responsibly support the process.",
  },
  VALIDATE_AI_OPPORTUNITIES: {
    label: "Review AI opportunities",
    description: "Review the detected AI opportunities and their evidence.",
  },
  PUBLISH_AI_OPPORTUNITIES: {
    label: "Approve AI opportunities",
    description: "Approve these opportunities before automation assessment.",
  },
  GENERATE_AUTOMATION_OPPORTUNITIES: {
    label: "Find automation opportunities",
    description: "Identify deterministic automation opportunities for the approved findings.",
  },
  VALIDATE_AUTOMATION_OPPORTUNITIES: {
    label: "Review automation opportunities",
    description: "Review the opportunities, constraints and supporting evidence.",
  },
  PUBLISH_AUTOMATION_OPPORTUNITIES: {
    label: "Approve automation opportunities",
    description: "Approve these opportunities before calculating ROI.",
  },
  ENTER_ROI_ASSUMPTIONS: {
    label: "Complete ROI assumptions",
    description: "ROI needs your company costs and operating assumptions before calculation.",
  },
  VALIDATE_ROI: {
    label: "Review ROI",
    description: "Confirm the calculated scenarios and their assumptions.",
  },
  PUBLISH_ROI: {
    label: "Approve ROI",
    description: "Approve the ROI scenarios before creating the action plan.",
  },
  GENERATE_RECOMMENDATIONS: {
    label: "Create the action plan",
    description: "Prioritize the approved opportunities into a practical roadmap.",
  },
  VALIDATE_RECOMMENDATIONS: {
    label: "Review the action plan",
    description: "Review the recommended priorities and implementation phases.",
  },
  PUBLISH_RECOMMENDATIONS: {
    label: "Approve the action plan",
    description: "Approve the final action plan for this audit.",
  },
  VIEW_RESULTS: {
    label: "View recommendations",
    description: "Open the completed action plan and its supporting results.",
  },
};

export function presentNextAction(
  model: AssistedAuditReadModel,
  companyId: string,
): AuditActionPresentation | null {
  const action = model.nextAction;
  if (!action) return null;
  const text = copy[action];
  if (action === "START_DISCOVERY" || action === "CONTINUE_DISCOVERY")
    return { kind: "navigate", ...text, href: `/companies/${companyId}/discovery` };
  if (action === "START_INTERVIEW" || action === "CONTINUE_INTERVIEW")
    return { kind: "navigate", ...text, href: `/companies/${companyId}/interview` };
  if (action === "VIEW_RESULTS") {
    const recommendation = artifact(model, "RECOMMENDATIONS");
    return recommendation
      ? { kind: "navigate", ...text, href: `/recommendations/${recommendation.id}` }
      : { kind: "unavailable", ...text };
  }
  if (action === "SELECT_PROCESS_MAP") return { kind: "unavailable", ...text };
  if (action === "ENTER_ROI_ASSUMPTIONS") return { kind: "unavailable", ...text };
  const request = commandFor(action, model, companyId);
  return request ? { kind: "command", ...text, request } : { kind: "unavailable", ...text };
}

export function presentProcessCandidateAction(
  candidate: AssistedAuditArtifactReference,
): AuditActionPresentation {
  const detail = `/process-maps/${candidate.id}`;
  if (candidate.status === "draft")
    return {
      kind: "command",
      label: "Validate this process",
      description: "Validate this candidate before approving it.",
      request: post(`/api/process-maps/${candidate.id}/validate`, candidate.lockVersion),
    };
  if (candidate.status === "validated")
    return {
      kind: "command",
      label: "Approve this process",
      description: "Approve this candidate before selecting it for analysis.",
      request: post(`/api/process-maps/${candidate.id}/publish`, candidate.lockVersion),
    };
  if (candidate.status === "published")
    return {
      kind: "command",
      label: "Analyze this process",
      description: "This explicit analysis selects the process for the audit.",
      request: post(`/api/process-maps/${candidate.id}/analyze`),
    };
  return {
    kind: "navigate",
    label: "Review this process",
    description: "Open the process details.",
    href: detail,
  };
}

export async function performAuditCommand(
  request: AuditCommandRequest,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const response = await fetcher(request.url, request.init);
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  if (!response.ok)
    throw new Error(payload?.error?.message ?? "This action could not be completed.");
}

export async function performAuditCommandAndRefresh(
  request: AuditCommandRequest,
  refresh: () => Promise<void>,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  await performAuditCommand(request, fetcher);
  await refresh();
}

export function createActionLock() {
  let locked = false;
  return {
    acquire() {
      if (locked) return false;
      locked = true;
      return true;
    },
    release() {
      locked = false;
    },
  };
}

function commandFor(
  action: AssistedAuditAction,
  model: AssistedAuditReadModel,
  companyId: string,
): AuditCommandRequest | null {
  const current = model.stages.find((stage) => stage.stage === model.currentStage)?.artifact;
  const endpoints: Partial<Record<AssistedAuditAction, string>> = {
    VALIDATE_DISCOVERY: current ? `/api/discovery-sessions/${current.id}/validate` : undefined,
    VALIDATE_INTERVIEW: current ? `/api/interviews/${current.id}/validate` : undefined,
    BUILD_KNOWLEDGE: `/api/companies/${companyId}/knowledge-snapshots`,
    BUILD_PROCESS_MAP: artifact(model, "KNOWLEDGE")
      ? `/api/knowledge-snapshots/${artifact(model, "KNOWLEDGE")!.id}/process-maps`
      : undefined,
    VALIDATE_PROCESS_MAP: current ? `/api/process-maps/${current.id}/validate` : undefined,
    PUBLISH_PROCESS_MAP: current ? `/api/process-maps/${current.id}/publish` : undefined,
    GENERATE_ANALYSIS: artifact(model, "PROCESS_MAP")
      ? `/api/process-maps/${artifact(model, "PROCESS_MAP")!.id}/analyze`
      : undefined,
    VALIDATE_ANALYSIS: current ? `/api/analysis/${current.id}/validate` : undefined,
    PUBLISH_ANALYSIS: current ? `/api/analysis/${current.id}/publish` : undefined,
    GENERATE_AI_OPPORTUNITIES: artifact(model, "BUSINESS_ANALYSIS")
      ? `/api/business-analysis/${artifact(model, "BUSINESS_ANALYSIS")!.id}/ai-opportunities`
      : undefined,
    VALIDATE_AI_OPPORTUNITIES: current ? `/api/ai-opportunities/${current.id}/validate` : undefined,
    PUBLISH_AI_OPPORTUNITIES: current ? `/api/ai-opportunities/${current.id}/publish` : undefined,
    GENERATE_AUTOMATION_OPPORTUNITIES: artifact(model, "AI_OPPORTUNITIES")
      ? `/api/ai-opportunities/${artifact(model, "AI_OPPORTUNITIES")!.id}/automation-opportunities`
      : undefined,
    VALIDATE_AUTOMATION_OPPORTUNITIES: current
      ? `/api/automation-opportunities/${current.id}/validate`
      : undefined,
    PUBLISH_AUTOMATION_OPPORTUNITIES: current
      ? `/api/automation-opportunities/${current.id}/publish`
      : undefined,
    VALIDATE_ROI: current ? `/api/roi/${current.id}/validate` : undefined,
    PUBLISH_ROI: current ? `/api/roi/${current.id}/publish` : undefined,
    GENERATE_RECOMMENDATIONS: artifact(model, "ROI")
      ? `/api/roi/${artifact(model, "ROI")!.id}/recommendations`
      : undefined,
    VALIDATE_RECOMMENDATIONS: current ? `/api/recommendations/${current.id}/validate` : undefined,
    PUBLISH_RECOMMENDATIONS: current ? `/api/recommendations/${current.id}/publish` : undefined,
  };
  const url = endpoints[action];
  if (!url) return null;
  return post(url, mutationNeedsLock(action) ? current?.lockVersion : undefined);
}

function mutationNeedsLock(action: AssistedAuditAction): boolean {
  return action.startsWith("VALIDATE_") || action.startsWith("PUBLISH_");
}

function post(url: string, lockVersion?: number): AuditCommandRequest {
  const hasBody = lockVersion !== undefined;
  return {
    url,
    init: {
      method: "POST",
      ...(hasBody
        ? {
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ lockVersion }),
          }
        : {}),
    },
  };
}

function artifact(model: AssistedAuditReadModel, stage: AssistedAuditStage) {
  return model.stages.find((candidate) => candidate.stage === stage)?.artifact ?? null;
}
