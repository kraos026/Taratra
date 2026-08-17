import type { AIProvider } from "../../../brain-evaluation/ai-interpretation-gateway";
import type {
  ExecutiveDecisionState,
  ExecutiveDecisionView,
  ExecutiveEconomicState,
  ExecutiveEvidenceStrength,
  ExecutivePriorityCard,
} from "./executive-decision-view";

export type ExecutiveExplanationLanguage = "en" | "fr";
export type ExecutiveExplanationSource = "PROVIDER" | "FALLBACK";

export interface ExecutiveExplanationDraft {
  readonly headline: string;
  readonly executiveSummary: string;
  readonly whyThisMatters: string;
  readonly whyAutomateXThinksThis: string;
  readonly whatWeKnow: readonly string[];
  readonly whatIsUncertain: readonly string[];
  readonly whatNotToDo: string | null;
  readonly recommendedNextStep: string;
  readonly economicExplanation: string;
  readonly whatWouldChangeThisDecision?: string;
}

export interface ExecutiveExplanationValidationResult {
  readonly valid: boolean;
  readonly issues: readonly string[];
}

export interface ExecutiveExplanation {
  readonly tenantId: string;
  readonly companyId: string;
  readonly brainRunId: string;
  readonly decisionCardId: string;
  readonly sourceViewReference: string;
  readonly opportunityId: string | null;
  readonly decisionState: ExecutiveDecisionState;
  readonly economicState: ExecutiveEconomicState;
  readonly evidenceStrength: ExecutiveEvidenceStrength;
  readonly priority: ExecutivePriorityCard["priority"];
  readonly evidenceReferences: readonly string[];
  readonly language: ExecutiveExplanationLanguage;
  readonly content: ExecutiveExplanationDraft;
  readonly source: ExecutiveExplanationSource;
  readonly providerMetadata: {
    readonly provider: string;
    readonly model: string;
  } | null;
  readonly validation: ExecutiveExplanationValidationResult;
}

export interface ExecutiveExplanationProviderInput {
  readonly language: ExecutiveExplanationLanguage;
  readonly decisionState: ExecutiveDecisionState;
  readonly problem: string;
  readonly probableCause: string;
  readonly evidenceSummary: {
    readonly evidenceStrength: ExecutiveEvidenceStrength;
    readonly supportingSources: readonly string[];
    readonly conflictingSources: readonly string[];
    readonly missingEvidence: readonly string[];
  };
  readonly contradictions: readonly string[];
  readonly uncertainty: readonly string[];
  readonly economicState: ExecutiveEconomicState;
  readonly whatToDoNow: string;
  readonly whatNotToDo: string | null;
  readonly nextAction: string;
}

export interface ExecutiveExplanationProviderOutput {
  readonly content: ExecutiveExplanationDraft;
  readonly provider: string;
  readonly model: string;
}

export interface ExecutiveExplanationProvider {
  explain(input: ExecutiveExplanationProviderInput): Promise<ExecutiveExplanationProviderOutput>;
}

export interface ExecutiveExplanationServiceInput {
  readonly view: ExecutiveDecisionView;
  readonly cardId: string;
  readonly language?: ExecutiveExplanationLanguage;
}

/** Presentation-only AI layer. The ExecutiveDecisionView remains authoritative. */
export class ExecutiveExplanationService {
  constructor(
    private readonly provider?: ExecutiveExplanationProvider,
    private readonly validator = new ExecutiveExplanationIntegrityValidator(),
  ) {}

  async explain(input: ExecutiveExplanationServiceInput): Promise<ExecutiveExplanation> {
    const language = input.language ?? "en";
    const card = input.view.priorityCards.find((item) => item.id === input.cardId);
    if (!card) throw new Error("Executive decision card was not found");
    const providerInput = boundedInput(input.view, card, language);
    if (this.provider) {
      try {
        const generated = await this.provider.explain(providerInput);
        const validation = this.validator.validate(card, input.view, generated.content);
        if (validation.valid)
          return explanationFor(
            input.view,
            card,
            language,
            generated.content,
            "PROVIDER",
            {
              provider: generated.provider,
              model: generated.model,
            },
            validation,
          );
      } catch {
        // Provider failures are intentionally absorbed by deterministic fallback.
      }
    }
    const fallback = deterministicFallback(card, input.view, language);
    const validation = this.validator.validate(card, input.view, fallback);
    return explanationFor(input.view, card, language, fallback, "FALLBACK", null, validation);
  }
}

export class ExecutiveAIProviderAdapter implements ExecutiveExplanationProvider {
  constructor(
    private readonly provider: AIProvider,
    private readonly model = "provider-selected",
  ) {}

  async explain(
    input: ExecutiveExplanationProviderInput,
  ): Promise<ExecutiveExplanationProviderOutput> {
    const result = await this.provider.interpret({
      requestId: `executive-explanation:${input.decisionState}:${input.language}`,
      tenantId: "presentation-only",
      sourceId: "executive-decision-view",
      sourceType: "EXECUTIVE_DECISION_VIEW",
      sourceText: JSON.stringify(input),
      task: "EXECUTIVE_EXPLANATION",
      schemaVersion: "f4.2",
      language: input.language,
      constraints: [
        "Do not change the authoritative decision state.",
        "Do not invent evidence, sources, recommendations or financial values.",
        "Preserve know/believe/unknown separation and material contradictions.",
      ],
    });
    const candidate = result.candidates[0];
    return {
      content: candidate
        ? parseProviderDraft(candidate.statement, input)
        : deterministicDraft(input),
      provider: result.provider,
      model: result.model || this.model,
    };
  }
}

export class ExecutiveExplanationIntegrityValidator {
  validate(
    card: ExecutivePriorityCard,
    view: ExecutiveDecisionView,
    content: ExecutiveExplanationDraft,
  ): ExecutiveExplanationValidationResult {
    const issues: string[] = [];
    const text = textOf(content);
    if (reversesDecision(card.recommendationState, text)) issues.push("decision reversal");
    if (reversesEconomics(card.economicState, text)) issues.push("economic-state reversal");
    if (removesUncertainty(card, view, text)) issues.push("removed uncertainty");
    if (hidesContradiction(view, card, text)) issues.push("hidden contradiction");
    if (hasInventedNumbers(view, text)) issues.push("invented financial or numeric value");
    if (hasUnsupportedCertainty(card, view, text)) issues.push("unsupported certainty");
    if (hasInventedSource(view, text)) issues.push("invented source");
    return Object.freeze({ valid: issues.length === 0, issues: Object.freeze(issues) });
  }
}

function boundedInput(
  view: ExecutiveDecisionView,
  card: ExecutivePriorityCard,
  language: ExecutiveExplanationLanguage,
): ExecutiveExplanationProviderInput {
  return Object.freeze({
    language,
    decisionState: card.recommendationState,
    problem: card.problem,
    probableCause: card.probableCause,
    evidenceSummary: Object.freeze({
      evidenceStrength: card.evidenceStrength,
      supportingSources: card.explanation.supportingSources,
      conflictingSources: card.explanation.conflictingSources,
      missingEvidence: card.explanation.missingEvidence,
    }),
    contradictions: view.contradictions,
    uncertainty: card.uncertainty,
    economicState: card.economicState,
    whatToDoNow: card.whatToDoNow,
    whatNotToDo: card.whatNotToDo,
    nextAction: card.nextBestAction,
  });
}

function explanationFor(
  view: ExecutiveDecisionView,
  card: ExecutivePriorityCard,
  language: ExecutiveExplanationLanguage,
  content: ExecutiveExplanationDraft,
  source: ExecutiveExplanationSource,
  providerMetadata: ExecutiveExplanation["providerMetadata"],
  validation: ExecutiveExplanationValidationResult,
): ExecutiveExplanation {
  return Object.freeze({
    tenantId: view.company.tenantId,
    companyId: view.company.id,
    brainRunId: view.traceability.brainRunId,
    decisionCardId: card.id,
    sourceViewReference: `executive-decision-view:${view.company.id}:${view.traceability.brainRunId}`,
    opportunityId: view.traceability.opportunityIds.includes(card.id) ? card.id : null,
    decisionState: card.recommendationState,
    economicState: card.economicState,
    evidenceStrength: card.evidenceStrength,
    priority: card.priority,
    evidenceReferences: card.evidenceReferences,
    language,
    content: freezeDraft(content),
    source,
    providerMetadata: providerMetadata ? Object.freeze({ ...providerMetadata }) : null,
    validation,
  });
}

function deterministicFallback(
  card: ExecutivePriorityCard,
  view: ExecutiveDecisionView,
  language: ExecutiveExplanationLanguage,
): ExecutiveExplanationDraft {
  if (language === "fr")
    return Object.freeze({
      headline: card.title,
      executiveSummary: `${card.problem} ${card.whatToDoNow}`,
      whyThisMatters: card.whyItMatters,
      whyAutomateXThinksThis: `AutomateX s'appuie sur ${card.evidenceStrength.toLowerCase()} preuve(s) et conserve les contradictions visibles.`,
      whatWeKnow: view.whatWeKnow,
      whatIsUncertain: Object.freeze([...card.uncertainty, ...view.contradictions]),
      whatNotToDo: card.whatNotToDo,
      recommendedNextStep: card.nextBestAction,
      economicExplanation: `Etat economique: ${card.economicState}. Aucun chiffre absent n'est invente.`,
      whatWouldChangeThisDecision:
        "Une preuve sourcee qui resout les inconnues ou contradictions materielles.",
    });
  return deterministicDraft({
    decisionState: card.recommendationState,
    problem: card.problem,
    probableCause: card.probableCause,
    evidenceSummary: {
      evidenceStrength: card.evidenceStrength,
      supportingSources: card.explanation.supportingSources,
      conflictingSources: card.explanation.conflictingSources,
      missingEvidence: card.explanation.missingEvidence,
    },
    contradictions: view.contradictions,
    uncertainty: card.uncertainty,
    economicState: card.economicState,
    whatToDoNow: card.whatToDoNow,
    whatNotToDo: card.whatNotToDo,
    nextAction: card.nextBestAction,
    language,
  });
}

function deterministicDraft(input: ExecutiveExplanationProviderInput): ExecutiveExplanationDraft {
  return Object.freeze({
    headline: headlineFor(input.decisionState, input.problem),
    executiveSummary: `${input.problem} ${input.whatToDoNow}`,
    whyThisMatters: `This matters because ${input.problem.toLowerCase()}.`,
    whyAutomateXThinksThis: `AutomateX has ${input.evidenceSummary.evidenceStrength.toLowerCase()} evidence and keeps uncertainty visible.`,
    whatWeKnow: Object.freeze(
      input.evidenceSummary.supportingSources.map((source) => `Supported by ${source}`),
    ),
    whatIsUncertain: Object.freeze([...input.uncertainty, ...input.contradictions]),
    whatNotToDo: input.whatNotToDo,
    recommendedNextStep: input.nextAction,
    economicExplanation: `Economic state: ${input.economicState}. No unavailable break-even or ROI is invented.`,
    whatWouldChangeThisDecision:
      "Source-backed evidence that resolves the missing or conflicting information.",
  });
}

function parseProviderDraft(
  statement: string,
  input: ExecutiveExplanationProviderInput,
): ExecutiveExplanationDraft {
  try {
    const parsed = JSON.parse(statement) as Partial<ExecutiveExplanationDraft>;
    return normalizeDraft(parsed, input);
  } catch {
    return normalizeDraft({ executiveSummary: statement }, input);
  }
}

function normalizeDraft(
  draft: Partial<ExecutiveExplanationDraft>,
  input: ExecutiveExplanationProviderInput,
): ExecutiveExplanationDraft {
  return Object.freeze({
    headline: nonEmpty(draft.headline, headlineFor(input.decisionState, input.problem)),
    executiveSummary: nonEmpty(draft.executiveSummary, `${input.problem} ${input.whatToDoNow}`),
    whyThisMatters: nonEmpty(draft.whyThisMatters, `This matters because ${input.problem}.`),
    whyAutomateXThinksThis: nonEmpty(
      draft.whyAutomateXThinksThis,
      `Evidence strength is ${input.evidenceSummary.evidenceStrength}.`,
    ),
    whatWeKnow: arrayOfStrings(draft.whatWeKnow),
    whatIsUncertain: arrayOfStrings(draft.whatIsUncertain),
    whatNotToDo: draft.whatNotToDo === undefined ? input.whatNotToDo : draft.whatNotToDo,
    recommendedNextStep: nonEmpty(draft.recommendedNextStep, input.nextAction),
    economicExplanation: nonEmpty(
      draft.economicExplanation,
      `Economic state: ${input.economicState}.`,
    ),
    ...(draft.whatWouldChangeThisDecision
      ? { whatWouldChangeThisDecision: draft.whatWouldChangeThisDecision }
      : {}),
  });
}

function headlineFor(state: ExecutiveDecisionState, problem: string): string {
  if (state === "DO_NOT_AUTOMATE") return `Do not automate: ${problem}`;
  if (state === "FIX_BEFORE_AUTOMATING") return `Fix first: ${problem}`;
  if (state === "NEEDS_MORE_EVIDENCE") return `More evidence needed: ${problem}`;
  return problem;
}

function textOf(content: ExecutiveExplanationDraft): string {
  return [
    content.headline,
    content.executiveSummary,
    content.whyThisMatters,
    content.whyAutomateXThinksThis,
    ...content.whatWeKnow,
    ...content.whatIsUncertain,
    content.whatNotToDo,
    content.recommendedNextStep,
    content.economicExplanation,
    content.whatWouldChangeThisDecision,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function reversesDecision(state: ExecutiveDecisionState, text: string): boolean {
  const automateNow =
    /\b(automate immediately|automate now|approve automation immediately|fully automate)\b/i.test(
      text,
    );
  if ((state === "DO_NOT_AUTOMATE" || state === "HUMAN_DECISION_REQUIRED") && automateNow)
    return true;
  if (state === "FIX_BEFORE_AUTOMATING" && automateNow) return true;
  if (state === "NEEDS_MORE_EVIDENCE" && automateNow) return true;
  return false;
}

function reversesEconomics(state: ExecutiveEconomicState, text: string): boolean {
  if (
    (state === "NOT_JUSTIFIED" || state === "INSUFFICIENT_EVIDENCE") &&
    /\beconomically justified\b/i.test(text)
  )
    return true;
  if (state === "ECONOMICALLY_JUSTIFIED" && /\bnot economically justified\b/i.test(text))
    return true;
  return false;
}

function removesUncertainty(
  card: ExecutivePriorityCard,
  view: ExecutiveDecisionView,
  text: string,
): boolean {
  const uncertainty = [...card.uncertainty, ...view.whatWeDoNotKnow];
  if (!uncertainty.length) return false;
  const uncertaintyLanguage =
    /\b(unknown|uncertain|missing|not know|clarify|more evidence|remains uncertain|needs evidence)\b/i.test(
      text,
    );
  return !uncertaintyLanguage;
}

function hidesContradiction(
  view: ExecutiveDecisionView,
  card: ExecutivePriorityCard,
  text: string,
): boolean {
  const hasContradiction =
    view.contradictions.length > 0 || card.explanation.conflictingSources.length > 0;
  if (!hasContradiction) return false;
  return !/\b(contradiction|contradict|conflict|conflicting|differs|different|inconsistent|stale)\b/i.test(
    text,
  );
}

function hasInventedNumbers(view: ExecutiveDecisionView, text: string): boolean {
  const textWithoutIds = text.replace(/\b[a-z][a-z0-9_-]*[-:]\d+(?:\.\d+)?\b/gi, "");
  const allowed = new Set(
    [
      ...numberValues(view.economicPresentation.benefitRange.min),
      ...numberValues(view.economicPresentation.benefitRange.max),
      ...numberValues(view.economicPresentation.costRange.min),
      ...numberValues(view.economicPresentation.costRange.max),
      ...numberValues(view.economicPresentation.breakEvenMonths),
      ...numberValues(view.economicPresentation.timeToValueMonths),
      ...numberValues(view.economicPresentation.costOfInaction),
    ].map((item) => item.toLowerCase()),
  );
  const matches = textWithoutIds.match(/\b\d+(?:[.,]\d+)?\s*(?:%|x|months?|mois|eur|€)?\b/gi) ?? [];
  return matches.some((match) => !allowed.has(match.trim().toLowerCase()));
}

function numberValues(value: number | null): readonly string[] {
  if (value === null) return [];
  return [String(value), `${value} eur`, `${value} €`, `${value} months`, `${value} mois`];
}

function hasUnsupportedCertainty(
  card: ExecutivePriorityCard,
  view: ExecutiveDecisionView,
  text: string,
): boolean {
  if (![...card.uncertainty, ...view.whatWeDoNotKnow].length) return false;
  return /\b(definitely|certainly|confirmed|proves|is definitely|without doubt)\b/i.test(text);
}

function hasInventedSource(view: ExecutiveDecisionView, text: string): boolean {
  const known = new Set(
    [
      ...view.evidenceExplanation.supportingSources,
      ...view.evidenceExplanation.conflictingSources,
      "erp",
      "sop",
      "manager",
      "management",
      "automatex",
    ].map((item) => item.toLowerCase()),
  );
  const sourceWords =
    text.match(/\b(?:crm|salesforce|hubspot|shopify|gmail|slack|quickbooks|stripe)\b/gi) ?? [];
  return sourceWords.some((source) => !known.has(source.toLowerCase()));
}

function nonEmpty(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function arrayOfStrings(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(value.filter((item): item is string => typeof item === "string"));
}

function freezeDraft(draft: ExecutiveExplanationDraft): ExecutiveExplanationDraft {
  return Object.freeze({
    ...draft,
    whatWeKnow: Object.freeze([...draft.whatWeKnow]),
    whatIsUncertain: Object.freeze([...draft.whatIsUncertain]),
  });
}
