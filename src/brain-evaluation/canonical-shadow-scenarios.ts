import type { BenchmarkCase } from "./canonical-shadow-types";

export const canonicalShadowBenchmarkVersion = "canonical-shadow-mvp.2";

export const canonicalShadowCases: readonly BenchmarkCase[] = Object.freeze([
  scenario({
    caseId: "manual_invoice_processing",
    title: "Manual supplier invoice processing",
    companyContext:
      "A 42-person B2B operations firm handles supplier invoices through email, spreadsheets and a small accounting system.",
    process: "Supplier invoice intake, validation, approval and posting",
    roles: ["Operations coordinator", "Accounting assistant", "Finance manager"],
    tools: ["Gmail", "Google Sheets", "Accounting ERP", "Bank portal"],
    workflow: [
      "Supplier invoices arrive in a shared inbox.",
      "An assistant reads each PDF and copies supplier, date, amount and due date into a spreadsheet.",
      "Exceptions wait for the finance manager before anyone posts them.",
      "Approved invoices are typed again into the accounting system.",
    ],
    volumes: { invoicesPerMonth: 85, exceptionsPerMonth: 17 },
    durations: { manualHoursPerMonth: 45, approvalDelayDays: "1-4" },
    manualWork: [
      "Reading invoice emails and attachments.",
      "Copying invoice fields into a spreadsheet.",
      "Re-entering approved invoices into the accounting tool.",
      "Chasing the finance manager for exception status.",
    ],
    painPoints: [
      "The team spends several days each month checking and copying invoices by hand.",
      "The same invoice details are entered in more than one place.",
      "Work pauses when the finance manager is unavailable for exception approval.",
    ],
    risks: [
      "Payment amounts can be typed incorrectly.",
      "The team has little visibility into which invoices are waiting.",
      "Exception approval depends on one senior person.",
    ],
    constraints: ["Exceptions above the approval threshold must still be reviewed by a human."],
    evidence: [
      evidence(
        "evidence:invoice:email",
        "Discovery notes",
        "Invoices arrive by email and invoice fields are copied manually from attachments.",
        0.9,
        ["manual_invoice_processing", "duplicate_entry"],
      ),
      evidence(
        "evidence:invoice:volume",
        "Finance manager interview",
        "The team estimated about 85 supplier invoices per month and roughly 45 hours of manual finance work.",
        0.85,
        ["high_manual_workload", "positive_roi"],
      ),
      evidence(
        "evidence:invoice:approval",
        "Operations interview",
        "Exceptions wait when the finance manager is away or busy.",
        0.85,
        ["single_point_of_failure", "approval_delay", "single_person_approval_dependency"],
      ),
    ],
    expectedFindings: [
      "manual_invoice_processing",
      "duplicate_entry",
      "high_manual_workload",
      "single_point_of_failure",
    ],
    expectedRootCauses: ["email_dependency", "single_person_approval_dependency"],
    expectedBottlenecks: ["finance_manager_approval"],
    expectedOpportunities: ["invoice_intake_automation", "exception_routing", "status_visibility"],
    forbiddenInventions: ["fully_autonomous_payment_release", "fraud_detection_ai"],
    expectedExclusions: ["remove_human_exception_approval"],
    expectedPriorityOrder: ["invoice_intake_automation", "exception_routing", "status_visibility"],
    expectedRoiDirection: "POSITIVE",
    requiredEvidence: [
      "evidence:invoice:email",
      "evidence:invoice:volume",
      "evidence:invoice:approval",
    ],
    risksToRecognize: ["single_point_of_failure", "payment_error"],
    aliases: {
      manual_invoice_processing: ["checking and copying invoices", "invoice fields are copied"],
      duplicate_entry: ["entered in more than one place", "typed again"],
      high_manual_workload: ["45 hours", "several days each month"],
      single_point_of_failure: ["depends on one senior person", "manager is away"],
      email_dependency: ["shared inbox", "email attachments"],
      single_person_approval_dependency: ["finance manager is away", "one senior person"],
      finance_manager_approval: ["exception approval", "manager before anyone posts"],
      invoice_intake_automation: ["read each PDF", "invoice fields"],
      exception_routing: ["exception approval", "approval threshold"],
      status_visibility: ["which invoices are waiting", "status"],
      payment_error: ["typed incorrectly", "payment amounts"],
    },
  }),
  scenario({
    caseId: "customer_support_overload",
    title: "Customer support overload",
    companyContext:
      "A SaaS support team receives repetitive account and billing questions while cancellation and refund decisions remain sensitive.",
    process: "Inbound customer support triage and response",
    roles: ["Support agent", "Support manager", "Billing specialist"],
    tools: ["Shared inbox", "Helpdesk", "Stripe dashboard", "Knowledge base"],
    workflow: [
      "Tickets arrive in the helpdesk.",
      "Agents manually decide whether each ticket is billing, account access or product support.",
      "Agents search old articles and Slack threads for approved wording.",
      "Billing cases wait for a specialist before refund or cancellation decisions.",
    ],
    volumes: { ticketsPerWeek: 420, repeatQuestionsPercent: 55 },
    durations: { averageFirstResponseHours: 9, manualTriageHoursPerWeek: 28 },
    manualWork: [
      "Sorting tickets by intent.",
      "Looking up approved answers.",
      "Routing billing questions to the correct specialist.",
    ],
    painPoints: [
      "More than half of weekly tickets repeat the same questions.",
      "First responses are slow because agents classify and research manually.",
      "Approved answers are spread across more than one place.",
    ],
    risks: [
      "Refund decisions can expose billing or privacy risk.",
      "Customers may churn while waiting.",
      "Agents may use outdated wording.",
    ],
    constraints: [
      "Refund and cancellation outcomes require human review.",
      "Customer personal information must not enter uncontrolled tools.",
    ],
    evidence: [
      evidence(
        "evidence:support:volume",
        "Helpdesk export",
        "The helpdesk export shows about 420 tickets per week; 55% are repetitive account or billing questions.",
        0.92,
        ["support_triage_overload", "slow_first_response", "positive_roi"],
      ),
      evidence(
        "evidence:support:kb",
        "Support manager interview",
        "Agents search several places before they find the approved answer.",
        0.8,
        ["knowledge_lookup_delay", "fragmented_knowledge"],
      ),
      evidence(
        "evidence:support:billing",
        "Support policy",
        "Refund and cancellation outcomes require human review by the billing specialist.",
        0.95,
        ["human_control_required", "billing_privacy", "billing_specialist_queue"],
      ),
    ],
    expectedFindings: ["support_triage_overload", "slow_first_response", "knowledge_lookup_delay"],
    expectedRootCauses: ["manual_ticket_classification", "fragmented_knowledge"],
    expectedBottlenecks: ["billing_specialist_queue"],
    expectedOpportunities: ["support_triage_assistant", "knowledge_answer_assistant"],
    forbiddenInventions: ["autonomous_refund_approval", "sentiment_based_cancellation_denial"],
    expectedExclusions: ["automate_refund_decisions"],
    expectedPriorityOrder: ["support_triage_assistant", "knowledge_answer_assistant"],
    expectedRoiDirection: "POSITIVE",
    requiredEvidence: [
      "evidence:support:volume",
      "evidence:support:kb",
      "evidence:support:billing",
    ],
    risksToRecognize: ["billing_privacy", "human_control_required"],
    aliases: {
      support_triage_overload: ["420 tickets", "repeat the same questions"],
      slow_first_response: ["first responses are slow", "nine hours"],
      knowledge_lookup_delay: ["approved answers", "several places"],
      manual_ticket_classification: ["classify", "sorting tickets"],
      fragmented_knowledge: ["spread across", "Slack threads"],
      billing_specialist_queue: ["billing cases wait", "billing specialist"],
      support_triage_assistant: ["sorting tickets", "classify intent"],
      knowledge_answer_assistant: ["approved answer", "knowledge base"],
      billing_privacy: ["billing or privacy risk", "personal information"],
      human_control_required: ["human review", "specialist"],
    },
  }),
  scenario({
    caseId: "employee_onboarding_hr_admin",
    title: "Employee onboarding and HR admin",
    companyContext:
      "A growing services firm coordinates onboarding tasks across HR, IT and line managers using emails and spreadsheets.",
    process: "Employee onboarding request, account setup and first-week readiness",
    roles: ["HR coordinator", "IT admin", "Hiring manager"],
    tools: ["HRIS", "Email", "Checklist spreadsheet", "Identity provider"],
    workflow: [
      "HR receives a hiring confirmation by email.",
      "HR creates a checklist and asks IT for account setup.",
      "The hiring manager confirms equipment and first-week training.",
      "HR follows up manually when tasks are late.",
    ],
    volumes: { hiresPerMonth: 6, taskCountPerHire: 18 },
    durations: { manualHoursPerHire: 3.5, averageDelayDays: 2 },
    manualWork: [
      "Creating onboarding checklists.",
      "Chasing account requests.",
      "Combining task status from HR, IT and managers.",
    ],
    painPoints: [
      "Every new hire creates many small coordination tasks.",
      "Account setup delays the first week when approvals are missed.",
      "HR spends time reminding other teams instead of doing higher-value work.",
    ],
    risks: [
      "Incorrect access can create security or privacy issues.",
      "Sensitive HR data should not be summarized into uncontrolled systems.",
    ],
    constraints: [
      "IT must approve account access.",
      "Salary, medical and performance information are outside automation scope.",
    ],
    evidence: [
      evidence(
        "evidence:onboarding:volume",
        "HR interview",
        "HR sees about six hires monthly, with roughly 18 tasks and 3.5 manual HR hours per hire.",
        0.78,
        ["manual_status_chasing"],
      ),
      evidence(
        "evidence:onboarding:access",
        "IT policy",
        "Account creation requires named IT approval before access is granted.",
        0.9,
        ["access_control_error", "human_control_required", "it_access_approval"],
      ),
      evidence(
        "evidence:onboarding:checklist",
        "Checklist sample",
        "Onboarding tasks are tracked through a spreadsheet and email reminders.",
        0.82,
        ["onboarding_checklist_fragmentation", "fragmented_onboarding_ownership"],
      ),
    ],
    expectedFindings: [
      "onboarding_checklist_fragmentation",
      "manual_status_chasing",
      "it_provisioning_delay",
    ],
    expectedRootCauses: ["fragmented_onboarding_ownership"],
    expectedBottlenecks: ["it_access_approval"],
    expectedOpportunities: ["onboarding_workflow_orchestration", "status_reminder_automation"],
    forbiddenInventions: ["automatic_access_granting", "employee_performance_scoring"],
    expectedExclusions: ["automate_sensitive_hr_judgments"],
    expectedPriorityOrder: ["onboarding_workflow_orchestration", "status_reminder_automation"],
    expectedRoiDirection: "NEUTRAL",
    requiredEvidence: ["evidence:onboarding:volume", "evidence:onboarding:access"],
    risksToRecognize: ["access_control_error", "privacy_sensitive_hr_data"],
    aliases: {
      onboarding_checklist_fragmentation: ["checklist", "spreadsheet and email reminders"],
      manual_status_chasing: ["reminding other teams", "follows up manually"],
      it_provisioning_delay: ["account setup delays", "approvals are missed"],
      fragmented_onboarding_ownership: ["HR, IT and managers", "coordination tasks"],
      it_access_approval: ["IT approval", "access is granted"],
      onboarding_workflow_orchestration: ["onboarding tasks", "coordination tasks"],
      status_reminder_automation: ["reminders", "follow up manually"],
      access_control_error: ["incorrect access", "security"],
      privacy_sensitive_hr_data: ["sensitive HR data", "salary", "medical"],
    },
  }),
  scenario({
    caseId: "sales_lead_qualification",
    title: "Sales lead qualification",
    companyContext:
      "A B2B sales team qualifies inbound leads with incomplete CRM fields and uncertain campaign attribution.",
    process: "Inbound lead scoring, qualification and sales assignment",
    roles: ["SDR", "Sales manager", "Marketing operations"],
    tools: ["Website form", "CRM", "Spreadsheet", "Email sequencing"],
    workflow: [
      "Website leads arrive with partial company information.",
      "The SDR fills in missing fields and estimates fit.",
      "The sales manager prioritizes named accounts.",
      "Marketing operations reconciles attribution after month end.",
    ],
    volumes: { leadsPerMonth: 260, missingCompanySizePercent: 38 },
    durations: { manualQualificationMinutes: 9, followupDelayHours: 18 },
    manualWork: ["Researching lead details.", "Scoring lead fit.", "Cleaning CRM data."],
    painPoints: [
      "Many leads are missing company size or industry.",
      "Follow-up is delayed while SDRs enrich records.",
      "Manual scoring is inconsistent across reps.",
    ],
    risks: [
      "Bad routing can send good leads to the wrong owner.",
      "Revenue impact is hard to prove because attribution is incomplete.",
    ],
    constraints: [
      "Conversion attribution is incomplete.",
      "The company does not want fully automated lead rejection.",
    ],
    evidence: [
      evidence(
        "evidence:sales:crm",
        "CRM export",
        "A CRM export shows 38% of inbound leads are missing company size.",
        0.88,
        ["inconsistent_crm_data", "missing_crm_fields"],
      ),
      evidence(
        "evidence:sales:sdr",
        "SDR interview",
        "Manual qualification takes roughly nine minutes per lead before assignment.",
        0.75,
        ["manual_lead_scoring", "sdr_enrichment_queue", "slow_lead_followup"],
      ),
      evidence(
        "evidence:sales:attribution",
        "Marketing operations note",
        "Campaign attribution is incomplete and sometimes corrected after the month closes.",
        0.8,
        ["unsupported_revenue_claims", "uncertain_attribution"],
      ),
    ],
    expectedFindings: ["inconsistent_crm_data", "slow_lead_followup", "manual_lead_scoring"],
    expectedRootCauses: ["missing_crm_fields", "uncertain_attribution"],
    expectedBottlenecks: ["sdr_enrichment_queue"],
    expectedOpportunities: ["lead_enrichment_assist", "routing_recommendation"],
    forbiddenInventions: ["guaranteed_revenue_uplift", "autonomous_lead_rejection"],
    expectedExclusions: ["fully_automated_disqualification"],
    expectedPriorityOrder: ["lead_enrichment_assist", "routing_recommendation"],
    expectedRoiDirection: "INSUFFICIENT_EVIDENCE",
    requiredEvidence: ["evidence:sales:crm", "evidence:sales:sdr", "evidence:sales:attribution"],
    risksToRecognize: ["unsupported_revenue_claims"],
    aliases: {
      inconsistent_crm_data: ["missing company size", "partial company information"],
      slow_lead_followup: ["follow-up is delayed", "before assignment"],
      manual_lead_scoring: ["manual scoring", "estimates fit"],
      missing_crm_fields: ["missing fields", "inbound leads are missing"],
      uncertain_attribution: ["attribution is incomplete", "corrected after"],
      sdr_enrichment_queue: ["SDRs enrich", "fills in missing fields"],
      lead_enrichment_assist: ["enrich records", "fill in missing"],
      routing_recommendation: ["send good leads", "assignment"],
      unsupported_revenue_claims: ["revenue impact is hard to prove", "attribution"],
    },
  }),
  scenario({
    caseId: "inventory_purchasing_workflow",
    title: "Inventory and purchasing workflow",
    companyContext:
      "A small distributor reviews stock levels in spreadsheets while purchase approvals and supplier orders happen by email.",
    process: "Inventory monitoring, reorder proposal and purchase approval",
    roles: ["Warehouse lead", "Purchasing coordinator", "Finance approver"],
    tools: ["Inventory system", "Excel", "Email", "Supplier portal"],
    workflow: [
      "The warehouse exports stock levels.",
      "Purchasing compares spreadsheet thresholds against recent demand.",
      "Finance approves large orders by email.",
      "The supplier order is entered manually into a portal.",
    ],
    volumes: { skuCount: 850, purchaseOrdersPerMonth: 48 },
    durations: { reorderReviewHoursPerWeek: 12, approvalDelayDays: "1-3" },
    manualWork: [
      "Exporting stock files.",
      "Checking reorder thresholds.",
      "Typing supplier orders.",
    ],
    painPoints: [
      "Reorder checks depend on spreadsheet formulas maintained by one coordinator.",
      "Purchase orders are typed manually into supplier portals.",
      "Late review can contribute to stockouts.",
    ],
    risks: [
      "Old stock exports can cause over-ordering or missed reorders.",
      "Large purchases need finance control.",
    ],
    constraints: [
      "Large purchases require finance approval.",
      "Inventory data freshness varies by warehouse.",
    ],
    evidence: [
      evidence(
        "evidence:inventory:sku",
        "Inventory export",
        "The business manages around 850 SKUs and 48 purchase orders per month.",
        0.9,
        ["spreadsheet_reorder_logic", "manual_purchase_entry", "positive_roi"],
      ),
      evidence(
        "evidence:inventory:freshness",
        "Warehouse interview",
        "The exported stock file can be a day out of date.",
        0.72,
        ["data_freshness_risk", "stale_inventory_export", "stockout_risk"],
      ),
      evidence(
        "evidence:inventory:approval",
        "Finance policy",
        "Large purchases require finance approval before the order is sent.",
        0.93,
        ["approval_control_required", "finance_purchase_approval"],
      ),
    ],
    expectedFindings: ["spreadsheet_reorder_logic", "manual_purchase_entry", "stockout_risk"],
    expectedRootCauses: ["manual_reorder_threshold_check", "stale_inventory_export"],
    expectedBottlenecks: ["finance_purchase_approval"],
    expectedOpportunities: ["reorder_alerting", "purchase_order_draft_automation"],
    forbiddenInventions: ["autonomous_large_purchase_approval", "perfect_real_time_inventory"],
    expectedExclusions: ["remove_finance_purchase_control"],
    expectedPriorityOrder: ["reorder_alerting", "purchase_order_draft_automation"],
    expectedRoiDirection: "POSITIVE",
    requiredEvidence: [
      "evidence:inventory:sku",
      "evidence:inventory:freshness",
      "evidence:inventory:approval",
    ],
    risksToRecognize: ["data_freshness_risk", "approval_control_required"],
    aliases: {
      spreadsheet_reorder_logic: ["spreadsheet formulas", "reorder thresholds"],
      manual_purchase_entry: ["typed manually", "supplier portals"],
      stockout_risk: ["stockouts", "missed reorders"],
      manual_reorder_threshold_check: ["checking reorder thresholds", "compares spreadsheet"],
      stale_inventory_export: ["day out of date", "old stock exports"],
      finance_purchase_approval: ["finance approves", "finance approval"],
      reorder_alerting: ["reorder checks", "missed reorders"],
      purchase_order_draft_automation: ["supplier order", "purchase orders"],
      data_freshness_risk: ["data freshness", "old stock exports"],
      approval_control_required: ["finance control", "finance approval"],
    },
  }),
]);

function scenario(input: {
  caseId: string;
  title: string;
  companyContext: string;
  process: string;
  roles: readonly string[];
  tools: readonly string[];
  workflow: readonly string[];
  volumes: Readonly<Record<string, number | string>>;
  durations: Readonly<Record<string, number | string>>;
  manualWork: readonly string[];
  painPoints: readonly string[];
  risks: readonly string[];
  constraints: readonly string[];
  evidence: readonly {
    readonly id: string;
    readonly source: string;
    readonly statement: string;
    readonly reliability: number;
    readonly supports: readonly string[];
  }[];
  expectedFindings: readonly string[];
  expectedRootCauses: readonly string[];
  expectedBottlenecks: readonly string[];
  expectedOpportunities: readonly string[];
  forbiddenInventions: readonly string[];
  expectedExclusions: readonly string[];
  expectedPriorityOrder: readonly string[];
  expectedRoiDirection: BenchmarkCase["hiddenGroundTruth"]["expectedRoiDirection"];
  requiredEvidence: readonly string[];
  risksToRecognize: readonly string[];
  aliases: Readonly<Record<string, readonly string[]>>;
}): BenchmarkCase {
  return deepFreeze({
    publicInput: {
      caseId: input.caseId,
      title: input.title,
      companyContext: input.companyContext,
      process: input.process,
      roles: input.roles,
      tools: input.tools,
      workflow: input.workflow,
      volumes: input.volumes,
      durations: input.durations,
      manualWork: input.manualWork,
      painPoints: input.painPoints,
      risks: input.risks,
      constraints: input.constraints,
      evidence: input.evidence.map(({ id, source, statement, reliability }) => ({
        id,
        source,
        statement,
        reliability,
      })),
    },
    scoringMetadata: {
      aliases: input.aliases,
      evidenceMappings: input.evidence.map(({ id, supports }) => ({
        evidenceId: id,
        supports,
      })),
    },
    hiddenGroundTruth: {
      expectedFindings: concepts(input.expectedFindings),
      expectedRootCauses: concepts(input.expectedRootCauses),
      expectedBottlenecks: concepts(input.expectedBottlenecks),
      expectedOpportunities: concepts(input.expectedOpportunities),
      forbiddenInventions: concepts(input.forbiddenInventions, true),
      expectedExclusions: concepts(input.expectedExclusions),
      expectedPriorityOrder: input.expectedPriorityOrder,
      expectedRoiDirection: input.expectedRoiDirection,
      requiredEvidence: input.requiredEvidence,
      risksToRecognize: input.risksToRecognize,
    },
  });
}

function evidence(
  id: string,
  source: string,
  statement: string,
  reliability: number,
  supports: readonly string[],
) {
  return { id, source, statement, reliability, supports };
}

function concepts(ids: readonly string[], critical = false) {
  return ids.map((id) => ({
    id,
    label: label(id),
    aliases: [label(id), id.replaceAll("_", " ")],
    critical,
  }));
}

function label(id: string): string {
  return id.replaceAll("_", " ");
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
