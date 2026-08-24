import pg from "pg";
import { chromium } from "@playwright/test";
import {
  LOCAL_APP_URL,
  LOCAL_E2E_USERS,
  assertLocalCertificationEnv,
  cleanNextArtifacts,
  certificationEnv,
  ensureLocalSupabase,
  runChecked,
  startProductionApp,
  stopProcessTree,
} from "./local-certification-support.mjs";
import { configureSystemChromeForPlaywright } from "./system-chrome.mjs";

const STAGES = [
  "Discovery",
  "Interview",
  "Enterprise Knowledge",
  "Process Map",
  "Business Analysis",
  "AI Opportunities",
  "Automation Opportunities",
  "ROI",
  "Recommendation Portfolio",
  "Solution Blueprint",
  "Automation Specification",
  "Executive Result",
];

const audit = {
  companyName: LOCAL_E2E_USERS.tenantA.companyName,
  industry: "Business operations services",
  processName: "Manual supplier invoice processing",
};

let appProcess = null;
let currentCompanyId = null;
let currentOrganizationId = null;
let db = null;
let browser = null;

async function login(page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(LOCAL_E2E_USERS.tenantA.email);
  await page.getByLabel(/password|mot de passe/i).fill(LOCAL_E2E_USERS.tenantA.password);
  await page.getByRole("button", { name: /se connecter|login|sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 30_000 });
  const response = await page.request.get("/api/companies");
  if (response.status() !== 200)
    throw new Error(`AUTHENTICATED API smoke failed: ${response.status()}`);
}

async function ensureCompany(page) {
  const searched = await api(
    page,
    `/api/companies?search=${encodeURIComponent(audit.companyName)}`,
  );
  const existing = firstItem(searched);
  if (existing?.id) return existing;
  const created = await api(page, "/api/companies", {
    method: "POST",
    status: [200, 201],
    body: {
      name: audit.companyName,
      sectorId: "operations",
      employeeCount: 42,
      companySize: "small",
      primaryContactName: "Certification Owner",
      primaryContactRole: "Operations Director",
      country: "France",
      description:
        "Certification tenant used to validate the canonical AutomateX audit flow with invoice processing evidence.",
      status: "active",
    },
  });
  return unwrapCompany(created);
}

class CanonicalCertification {
  constructor(page, companyId, organizationId) {
    this.page = page;
    this.companyId = companyId;
    this.organizationId = organizationId;
    this.results = {};
  }

  async run() {
    await this.createAudit();
    await this.discovery();
    await this.interview();
    await this.knowledge();
    await this.processMap();
    await this.analysis();
    await this.aiOpportunity();
    await this.automationOpportunity();
    await this.roi();
    await this.recommendationPortfolio();
    await this.solutionBlueprint();
    await this.automationSpecification();
    await this.executiveResult();
    return this.results;
  }

  async createAudit() {
    const version = await one(
      `select id from public.questionnaire_versions
       where status = 'published'
       order by published_at desc nulls last, created_at desc
       limit 1`,
    );
    if (!version) throw new Error("AUDIT: no published questionnaire version");
    const created = await api(this.page, "/api/audits", {
      method: "POST",
      status: [200, 201],
      body: { companyId: this.companyId, questionnaireVersionId: version.id },
    });
    this.results.auditId = idFrom(created) ?? (await latestId("audits", "company_id"));
    assertUuid(this.results.auditId, "Audit");
  }

  async discovery() {
    let session = await api(this.page, `/api/companies/${this.companyId}/discovery`, {
      method: "POST",
      status: [200, 201],
    });
    let lockVersion =
      lockFrom(session) ?? (await lockVersionFor("discovery_sessions", idFrom(session)));
    const sessionId = idFrom(session) ?? (await latestId("discovery_sessions", "company_id"));
    assertUuid(sessionId, "Discovery session");
    for (const payload of discoveryPayloads()) {
      session = await api(this.page, `/api/discovery-sessions/${sessionId}`, {
        method: "PATCH",
        body: { lockVersion, payload },
      });
      lockVersion = lockFrom(session) ?? (await lockVersionFor("discovery_sessions", sessionId));
    }
    await api(this.page, `/api/discovery-sessions/${sessionId}/validate`, { method: "POST" });
    await expectStatus("discovery_sessions", sessionId, "validated");
    this.results.discoverySessionId = sessionId;
    this.results.discovery = "validated";
    this.logStage("Discovery", sessionId);
  }

  async interview() {
    let view = await api(this.page, `/api/companies/${this.companyId}/interviews`, {
      method: "POST",
      status: [200, 201],
    });
    const sessionId = idFrom(view) ?? (await latestId("interview_sessions", "company_id"));
    assertUuid(sessionId, "Interview session");

    for (let i = 0; i < 80; i += 1) {
      if (view?.progress?.readyForProcessMapping || view?.session?.status === "completed") break;
      const question = nextQuestion(view);
      if (!question) break;
      view = await api(this.page, `/api/interviews/${sessionId}/answer`, {
        method: "POST",
        body: {
          lockVersion: lockFrom(view) ?? (await lockVersionFor("interview_sessions", sessionId)),
          questionId: question.id,
          value: answerFor(question),
          confidence: "confirmed",
        },
      });
    }

    const completed = await api(this.page, `/api/interviews/${sessionId}/complete`, {
      method: "POST",
    });
    await api(this.page, `/api/interviews/${sessionId}/validate`, { method: "POST" });
    const status = await statusFor("interview_sessions", sessionId);
    if (!["validated", "completed"].includes(status)) {
      throw new Error(
        `Interview did not validate; status=${status}; completion=${JSON.stringify(completed?.progress ?? {})}`,
      );
    }
    this.results.interviewSessionId = sessionId;
    this.results.interview = status;
    this.logStage("Interview", sessionId);
  }

  async knowledge() {
    const result = await api(this.page, `/api/companies/${this.companyId}/knowledge-snapshots`, {
      method: "POST",
      status: [200, 201],
    });
    const id = idFrom(result) ?? (await latestId("knowledge_snapshots", "company_id"));
    assertUuid(id, "Knowledge snapshot");
    await expectStatus("knowledge_snapshots", id, "ready");
    const counts = await countsFor(["knowledge_sources", "knowledge_facts", "knowledge_nodes"]);
    if (Object.values(counts).some((count) => count < 1))
      throw new Error(`Knowledge snapshot incomplete: ${JSON.stringify(counts)}`);
    this.results.knowledgeSnapshotId = id;
    this.logStage("Enterprise Knowledge", id);
  }

  async processMap() {
    const built = await api(
      this.page,
      `/api/knowledge-snapshots/${this.results.knowledgeSnapshotId}/process-maps`,
      {
        method: "POST",
        status: [200, 201],
      },
    );
    const invoiceMap = await one(
      `select pm.id
       from public.process_maps pm
       join public.process_patterns pp on pp.id = pm.process_pattern_id
       where pm.organization_id = $1
         and pm.company_id = $2
         and pp.code = 'invoice_processing'
       order by pm.created_at desc
       limit 1`,
      [this.organizationId, this.companyId],
    );
    const id = invoiceMap?.id ?? idFrom(built) ?? (await latestId("process_maps", "company_id"));
    assertUuid(id, "Process map");
    await this.validatePublish("process-maps", "process_maps", id);
    await expectStatus("process_maps", id, "published");
    this.results.processMapId = id;
    this.logStage("Process Map", id);
  }

  async analysis() {
    const built = await api(this.page, `/api/process-maps/${this.results.processMapId}/analyze`, {
      method: "POST",
      status: [200, 201],
    });
    const id = idFrom(built) ?? (await latestId("analysis_snapshots", "company_id"));
    assertUuid(id, "Business analysis");
    await this.validatePublish("analysis", "analysis_snapshots", id);
    await expectStatus("analysis_snapshots", id, "published");
    this.results.analysisId = id;
    this.logStage("Business Analysis", id);
  }

  async aiOpportunity() {
    const built = await api(
      this.page,
      `/api/business-analysis/${this.results.analysisId}/ai-opportunities`,
      {
        method: "POST",
        status: [200, 201],
      },
    );
    const snapshotId = idFrom(built) ?? (await latestId("ai_opportunity_snapshots", "company_id"));
    const opportunityId = (
      await one(`select id from public.ai_opportunities where snapshot_id = $1 limit 1`, [
        snapshotId,
      ])
    )?.id;
    assertUuid(snapshotId, "AI opportunity snapshot");
    assertUuid(opportunityId, "AI opportunity");
    await this.validatePublish("ai-opportunities", "ai_opportunity_snapshots", snapshotId);
    await expectStatus("ai_opportunity_snapshots", snapshotId, "published");
    this.results.aiOpportunitySnapshotId = snapshotId;
    this.results.aiOpportunityId = opportunityId;
    this.logStage("AI Opportunities", snapshotId);
  }

  async automationOpportunity() {
    const built = await api(
      this.page,
      `/api/ai-opportunities/${this.results.aiOpportunitySnapshotId}/automation-opportunities`,
      {
        method: "POST",
        status: [200, 201],
      },
    );
    const snapshotId =
      idFrom(built) ?? (await latestId("automation_opportunity_snapshots", "company_id"));
    const opportunityId = (
      await one(`select id from public.automation_opportunities where snapshot_id = $1 limit 1`, [
        snapshotId,
      ])
    )?.id;
    assertUuid(snapshotId, "Automation opportunity snapshot");
    assertUuid(opportunityId, "Automation opportunity");
    await this.validatePublish(
      "automation-opportunities",
      "automation_opportunity_snapshots",
      snapshotId,
    );
    await expectStatus("automation_opportunity_snapshots", snapshotId, "published");
    this.results.automationOpportunitySnapshotId = snapshotId;
    this.results.automationOpportunityId = opportunityId;
    this.logStage("Automation Opportunities", snapshotId);
  }

  async roi() {
    const built = await api(
      this.page,
      `/api/automation-opportunities/${this.results.automationOpportunitySnapshotId}/roi`,
      {
        method: "POST",
        status: [200, 201],
        body: {
          currency: "EUR",
          assumptions: {
            hourly_cost: 38,
            working_days: 220,
            working_hours: 7.5,
            monthly_frequency: 85,
            annual_frequency: 1020,
            hours_saved_per_occurrence: 0.45,
            implementation_cost: 12500,
            maintenance_cost: 1800,
            training_cost: 1500,
            infrastructure_cost: 900,
            error_cost: 120,
          },
        },
      },
    );
    const id = idFrom(built) ?? (await latestId("roi_evaluation_snapshots", "company_id"));
    assertUuid(id, "ROI evaluation");
    await this.validatePublish("roi", "roi_evaluation_snapshots", id);
    await expectStatus("roi_evaluation_snapshots", id, "published");
    this.results.roiId = id;
    this.logStage("ROI", id);
  }

  async recommendationPortfolio() {
    const built = await api(this.page, `/api/roi/${this.results.roiId}/recommendations`, {
      method: "POST",
      status: [200, 201],
    });
    const id =
      idFrom(built) ?? (await latestId("recommendation_portfolio_snapshots", "company_id"));
    assertUuid(id, "Recommendation portfolio");
    await this.validatePublish("recommendations", "recommendation_portfolio_snapshots", id);
    await expectStatus("recommendation_portfolio_snapshots", id, "published");
    const recommendationSummary = await one(
      `with ranked as (
         select id
         from public.transformation_recommendations
         where snapshot_id = $1
         order by priority_score desc nulls last, created_at asc, id asc
         limit 1
       )
       select
         (select count(*)::int from public.transformation_recommendations where snapshot_id = $1) as count,
         (select id::text from ranked) as recommendation_id`,
      [id],
    );
    const recommendationCount = Number(recommendationSummary.count);
    if (recommendationCount < 1) throw new Error("Recommendation portfolio has no recommendations");
    this.results.recommendationPortfolioId = id;
    this.results.recommendationId = recommendationSummary.recommendation_id;
    this.results.recommendationCount = recommendationCount;
    this.logStage("Recommendation Portfolio", id);
  }

  async solutionBlueprint() {
    const built = await api(
      this.page,
      `/api/recommendations/${this.results.recommendationId}/solution-blueprints`,
      {
        method: "POST",
        status: [200, 201],
      },
    );
    const id = idFrom(built) ?? (await latestId("solution_blueprints", "company_id"));
    assertUuid(id, "Solution blueprint");
    await this.validatePublish("solution-blueprints", "solution_blueprints", id);
    await expectStatus("solution_blueprints", id, "published");
    this.results.solutionBlueprintId = id;
    this.logStage("Solution Blueprint", id);
  }

  async automationSpecification() {
    const built = await api(
      this.page,
      `/api/solution-blueprints/${this.results.solutionBlueprintId}/automation-specifications`,
      {
        method: "POST",
        status: [200, 201],
      },
    );
    const id = idFrom(built) ?? (await latestId("automation_specifications", "company_id"));
    assertUuid(id, "Automation specification");
    await this.validatePublish("automation-specifications", "automation_specifications", id);
    await expectStatus("automation_specifications", id, "published");
    this.results.automationSpecificationId = id;
    this.logStage("Automation Specification", id);
  }

  async executiveResult() {
    const result = await api(
      this.page,
      `/api/companies/${this.companyId}/automation-audit/decision-center`,
    );
    const center = result.decisionCenter ?? result;
    if (center.status !== "READY")
      throw new Error(`Executive Result is not READY: ${center.status}`);
    if (center.completeness?.status !== "YES")
      throw new Error(`Executive Result completeness is not YES: ${center.completeness?.status}`);
    if ((center.priorityCards?.length ?? 0) < 1)
      throw new Error("Executive Result has no patron-facing priority cards");
    this.results.executiveResult = {
      status: center.status,
      complete: center.completeness.status === "YES",
      cards: center.priorityCards.length,
    };
    this.logStage("Executive Result", "READY");
  }

  async validatePublish(routeSegment, table, id) {
    let lockVersion = await lockVersionFor(table, id);
    await api(this.page, `/api/${routeSegment}/${id}/validate`, {
      method: "POST",
      body: { lockVersion },
    });
    lockVersion = await lockVersionFor(table, id);
    await api(this.page, `/api/${routeSegment}/${id}/publish`, {
      method: "POST",
      body: { lockVersion },
    });
  }

  logStage(stage, id) {
    console.log(`CANONICAL ${stage}: PASS (${id})`);
  }
}

function discoveryPayloads() {
  return [
    {
      step: "company",
      industry: audit.industry,
      countryCode: "FR",
      employeeCount: 42,
      description:
        "The company runs recurring finance and operations workflows, including manual supplier invoice intake and approvals.",
    },
    {
      step: "business",
      businessModel: "B2B services",
      growthStage: "growth",
      revenueAmount: 1_200_000,
      revenueCurrency: "EUR",
      revenueYear: 2026,
      offerings: [
        {
          type: "service",
          name: "Managed operations",
          description: "Recurring back-office operations support.",
        },
        {
          type: "service",
          name: "Financial administration",
          description: "Supplier invoice administration and payment preparation.",
        },
      ],
      objectives: [
        {
          title: "Reduce supplier invoice cycle time",
          description: "Shorten the delay between invoice receipt and approval.",
          priority: 5,
          targetDate: null,
        },
        {
          title: "Remove duplicate manual entry",
          description: "Avoid retyping invoice data across spreadsheet and ERP tools.",
          priority: 5,
          targetDate: null,
        },
      ],
      challenges: [
        {
          title: "Duplicate invoice entry",
          description: "Invoice data is copied from email to spreadsheets and accounting software.",
          severity: 5,
        },
        {
          title: "Approval delay",
          description: "Approvals wait when the finance manager is unavailable.",
          severity: 4,
        },
      ],
    },
    {
      step: "organization",
      departments: [
        {
          clientId: "finance",
          name: "Finance",
          description: "Owns supplier invoices, approvals, and payment preparation.",
          headcount: 6,
        },
        {
          clientId: "operations",
          name: "Operations",
          description: "Coordinates incoming supplier documents and exception follow-up.",
          headcount: 12,
        },
      ],
      roles: [
        {
          departmentClientId: "finance",
          title: "Finance Manager",
          headcount: 1,
          responsibilities: ["Approve invoices", "Resolve exceptions", "Validate payments"],
        },
        {
          departmentClientId: "finance",
          title: "Accounting Assistant",
          headcount: 3,
          responsibilities: ["Read invoice emails", "Enter invoice data", "Update spreadsheets"],
        },
        {
          departmentClientId: "operations",
          title: "Operations Coordinator",
          headcount: 2,
          responsibilities: ["Chase missing supplier data", "Track invoice status"],
        },
      ],
    },
    {
      step: "software",
      items: [
        {
          name: "Gmail",
          purpose: "Supplier invoice email intake",
          criticality: 5,
          usersCount: 8,
        },
        {
          name: "Google Sheets",
          purpose: "Manual invoice tracking",
          criticality: 5,
          usersCount: 7,
        },
        {
          name: "Accounting ERP",
          purpose: "Invoice accounting and payment preparation",
          criticality: 5,
          usersCount: 5,
        },
        { name: "Bank Portal", purpose: "Payment review", criticality: 3, usersCount: 2 },
      ],
    },
    {
      step: "processes",
      items: [
        {
          name: audit.processName,
          categoryCode: "finance",
          description:
            "Supplier invoices arrive by email, are manually checked, copied into a spreadsheet, approved by the finance manager, and then re-entered into the accounting ERP.",
          frequency: "weekly",
          volume: 85,
          manualHoursMonth: 45,
          painPoints: [
            "Manual data entry from invoice email to spreadsheet",
            "Duplicate entry into accounting ERP",
            "Approval delays when one approver is absent",
            "No reliable status visibility for exceptions",
          ],
        },
      ],
    },
    { step: "review", confirmed: true },
  ];
}

function nextQuestion(view) {
  if (view?.nextQuestion) return view.nextQuestion;
  const answers = new Set((view?.answers ?? []).map((answer) => answer.questionId));
  return (view?.questions ?? []).find(
    (question) => question.mandatory && !answers.has(question.id),
  );
}

function answerFor(question) {
  const text =
    `${question.label ?? ""} ${question.code ?? ""} ${question.helpText ?? ""}`.toLowerCase();
  const type = question.type ?? question.answerType;
  if (type === "boolean") return true;
  if (type === "number") {
    if (/hour|time|duration|temps|manual/.test(text)) return 45;
    if (/cost|rate|price|co[uû]t/.test(text)) return 38;
    if (/volume|frequency|count|invoice/.test(text)) return 85;
    return 7;
  }
  if (type === "single_choice") return firstOption(question);
  if (type === "multiple_choice") return [firstOption(question)].filter(Boolean);
  return "Supplier invoice processing is manual: invoices arrive by email, data is copied into a spreadsheet, approval waits on one finance manager, then the data is re-entered into the accounting ERP. Around 85 invoices are handled monthly and roughly 45 hours are spent each month.";
}

function firstOption(question) {
  const options = question.options ?? question.choices ?? [];
  const first = options[0];
  if (typeof first === "string") return first;
  return first?.value ?? first?.id ?? first?.label ?? "yes";
}

async function api(page, path, options = {}) {
  const response = await page.request.fetch(path, {
    method: options.method ?? "GET",
    data: options.body,
    headers: options.body ? { "content-type": "application/json" } : undefined,
  });
  const text = await response.text();
  const expected = Array.isArray(options.status) ? options.status : [options.status ?? 200];
  if (!expected.includes(response.status())) {
    throw new Error(
      `API ${options.method ?? "GET"} ${path} expected ${expected.join("/")} got ${response.status()}: ${text.slice(0, 800)}`,
    );
  }
  const json = text ? JSON.parse(text) : null;
  if (json?.success === false) {
    throw new Error(`API ${path} failed: ${JSON.stringify(json.error)}`);
  }
  return json?.data ?? json;
}

function firstItem(value) {
  const data = value?.data ?? value;
  if (Array.isArray(data)) return data[0];
  if (Array.isArray(data?.items)) return data.items[0];
  if (Array.isArray(data?.companies)) return data.companies[0];
  return null;
}

function unwrapCompany(value) {
  return value?.company ?? value?.data?.company ?? value;
}

function idFrom(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value.id) return value.id;
  for (const key of [
    "session",
    "snapshot",
    "processMap",
    "analysis",
    "portfolio",
    "blueprint",
    "specification",
    "audit",
  ]) {
    if (value[key]?.id) return value[key].id;
  }
  const item = firstItem(value);
  return item?.id ?? null;
}

function lockFrom(value) {
  if (!value) return null;
  if (Number.isInteger(value.lockVersion)) return value.lockVersion;
  for (const key of [
    "session",
    "snapshot",
    "processMap",
    "analysis",
    "portfolio",
    "blueprint",
    "specification",
    "audit",
  ]) {
    if (Number.isInteger(value[key]?.lockVersion)) return value[key].lockVersion;
  }
  return null;
}

async function latestId(table, companyColumn) {
  const row = await one(
    `select id from public.${table}
     where organization_id = $1 and ${companyColumn} = $2
     order by created_at desc
     limit 1`,
    [currentOrganizationId, currentCompanyId],
  );
  return row?.id ?? null;
}

async function lockVersionFor(table, id) {
  const row = await one(`select lock_version from public.${table} where id = $1`, [id]);
  if (!row) throw new Error(`${table} ${id} not found for lock_version`);
  return row.lock_version;
}

async function statusFor(table, id) {
  const row = await one(`select status from public.${table} where id = $1`, [id]);
  return row?.status;
}

async function expectStatus(table, id, expected) {
  const actual = await statusFor(table, id);
  if (actual !== expected)
    throw new Error(`${table} ${id} status expected ${expected} got ${actual}`);
}

async function countsFor(tables) {
  const counts = {};
  for (const table of tables) {
    const row = await one(`select count(*)::int as count from public.${table}`);
    counts[table] = Number(row.count);
  }
  return counts;
}

async function tenantUser(label) {
  const email = label === "A" ? LOCAL_E2E_USERS.tenantA.email : LOCAL_E2E_USERS.tenantB.email;
  const row = await one(
    `select om.organization_id, om.user_id
     from public.organization_members om
     join auth.users u on u.id = om.user_id
     where lower(u.email) = lower($1)
     limit 1`,
    [email],
  );
  if (!row) throw new Error(`Tenant ${label} membership missing`);
  currentOrganizationId = row.organization_id;
  return row;
}

async function assertTenantBIsolation(companyId) {
  const tenantB = await one(
    `select om.organization_id
     from public.organization_members om
     join auth.users u on u.id = om.user_id
     where lower(u.email) = lower($1)
     limit 1`,
    [LOCAL_E2E_USERS.tenantB.email],
  );
  const visible = await one(
    `select count(*)::int as count
     from public.companies
     where organization_id = $1 and id = $2 and deleted_at is null`,
    [tenantB.organization_id, companyId],
  );
  if (Number(visible.count) !== 0)
    throw new Error("Tenant B can see Tenant A company in tenant-scoped query");
}

async function assertRefreshPersistence(page, companyId, result) {
  await page.goto(`/companies/${companyId}/automation-audit/results`);
  await page.reload();
  const center = await api(page, `/api/companies/${companyId}/automation-audit/decision-center`);
  if (center.decisionCenter?.status !== "READY")
    throw new Error("Decision Center not persisted after refresh");
  const rows = await one(
    `select
       (select count(*)::int from public.recommendation_portfolio_snapshots where id = $1 and status = 'published') as recommendations,
       (select count(*)::int from public.solution_blueprints where id = $2 and status = 'published') as blueprints,
       (select count(*)::int from public.automation_specifications where id = $3 and status = 'published') as specifications`,
    [
      result.recommendationPortfolioId,
      result.solutionBlueprintId,
      result.automationSpecificationId,
    ],
  );
  if (
    Number(rows.recommendations) !== 1 ||
    Number(rows.blueprints) !== 1 ||
    Number(rows.specifications) !== 1
  )
    throw new Error(`Persistence check failed: ${JSON.stringify(rows)}`);
  console.log("PERSISTENCE AFTER REFRESH: PASS");
}

async function reportSuccess(result) {
  console.log("CANONICAL CERTIFICATION: PASS");
  for (const stage of STAGES) console.log(`${stage}: PASS`);
  console.log(`recommendation count: ${result.recommendationCount}`);
  console.log(`executive result complete: ${result.executiveResult.complete}`);
}

async function one(sql, params = []) {
  const result = await db.query(sql, params);
  return result.rows[0] ?? null;
}

function assertUuid(value, label) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      String(value ?? ""),
    )
  ) {
    throw new Error(`${label} id missing/invalid: ${value}`);
  }
}

async function main() {
  const supabase = await ensureLocalSupabase();
  const env = certificationEnv(supabase);
  assertLocalCertificationEnv(env);
  configureSystemChromeForPlaywright(env);

  console.log("TARGET = local Supabase");
  console.log("ENVIRONMENT = LOCAL CERTIFICATION");
  console.log("PRODUCTION = NO");
  console.log("REMOTE SUPABASE = FORBIDDEN");

  runChecked("node", ["scripts/certification-db-guard.mjs"], env);
  runChecked("npx", ["prisma", "validate"], env);
  runChecked("npx", ["prisma", "generate"], env);
  runChecked("node", ["scripts/ensure-local-certification-identities.mjs"], env);
  cleanNextArtifacts();
  runChecked("npm", ["run", "build"], env);

  appProcess = await startProductionApp(env);

  db = new pg.Client({ connectionString: env.DATABASE_URL });
  await db.connect();

  browser = await chromium.launch({
    channel: env.PLAYWRIGHT_BROWSER_CHANNEL ?? "chrome",
    executablePath: env.AUTOMATEX_SYSTEM_CHROME_PATH,
    headless: true,
  });

  try {
    const context = await browser.newContext({ baseURL: LOCAL_APP_URL });
    const page = await context.newPage();
    await login(page);

    const user = await tenantUser("A");
    const company = await ensureCompany(page);
    currentCompanyId = company.id;
    await assertTenantBIsolation(company.id);
    const certification = new CanonicalCertification(page, company.id, user.organization_id);
    const result = await certification.run();

    await assertRefreshPersistence(page, company.id, result);
    await reportSuccess(result);
  } finally {
    await browser?.close().catch(() => undefined);
    await db?.end().catch(() => undefined);
    if (appProcess) {
      stopProcessTree(appProcess);
      appProcess = null;
    }
  }
}

process.on("SIGINT", () => {
  if (appProcess) stopProcessTree(appProcess);
  process.exit(130);
});

await main();
