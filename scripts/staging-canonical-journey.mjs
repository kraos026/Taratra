import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { discoveryPayloads, answerFor, nextQuestion } from "./staging-canonical-fixture.mjs";

// Product writes go through the authenticated application API. The staging
// admin client is used ONLY for readback; it never seeds downstream artifacts.
export async function certifyStagingJourney({ api, pages, admin, companyId, evidence }) {
  assert.equal(evidence.environment, "STAGING");
  const companyResponse = await admin
    .from("companies")
    .select("organization_id")
    .eq("id", companyId)
    .single();
  assert.equal(companyResponse.error, null, "company readback unavailable");
  const organizationId = companyResponse.data.organization_id;
  const ids = {};
  evidence.canonical = { stages: [], artifacts: ids };
  const ownerApi = async (path, method = "GET", data) => {
    const response = await api(pages[0], path, method, data, [200, 201]);
    const body = await response.json();
    assert.notEqual(body.success, false, "canonical API rejected request");
    return body.data ?? body;
  };
  async function row(table, id, columns = "*") {
    const result = await admin
      .from(table)
      .select(columns)
      .eq("organization_id", organizationId)
      .eq("id", id)
      .single();
    assert.equal(result.error, null, `scoped ${table} readback unavailable`);
    return result.data;
  }
  async function latest(table, parentColumn = "company_id", parentId = companyId) {
    const result = await admin
      .from(table)
      .select("id")
      .eq("organization_id", organizationId)
      .eq(parentColumn, parentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    assert.equal(result.error, null, `scoped latest ${table} unavailable`);
    return result.data.id;
  }
  async function publish(route, table, id) {
    const before = await row(table, id, "lock_version");
    await ownerApi(`/api/${route}/${id}/validate`, "POST", { lockVersion: before.lock_version });
    const validated = await row(table, id, "lock_version");
    await ownerApi(`/api/${route}/${id}/publish`, "POST", { lockVersion: validated.lock_version });
    assert.equal((await row(table, id, "status")).status, "published");
  }
  async function stage(name, action) {
    evidence.canonical.currentStage = name;
    const start = performance.now();
    await action();
    evidence.canonical.stages.push({
      stage: name,
      result: "PASS",
      milliseconds: Math.round(performance.now() - start),
    });
    console.log(`STAGING CANONICAL ${name}: PASS`);
  }
  const templates = await admin
    .from("questionnaire_templates")
    .select("id")
    .is("deleted_at", null)
    .or(`is_system.eq.true,organization_id.eq.${organizationId}`);
  assert.equal(templates.error, null, "accessible questionnaire templates unavailable");
  assert.ok(templates.data.length > 0, "no accessible questionnaire template");
  const questionnaire = await admin
    .from("questionnaire_versions")
    .select("id")
    .eq("status", "published")
    .in(
      "questionnaire_template_id",
      templates.data.map((template) => template.id),
    )
    .order("published_at", { ascending: false })
    .limit(1)
    .single();
  assert.equal(questionnaire.error, null, "published questionnaire unavailable");
  await ownerApi("/api/audits", "POST", {
    companyId,
    questionnaireVersionId: questionnaire.data.id,
  });
  await stage("Discovery", async () => {
    ids.discovery = await latest("discovery_sessions");
    for (const payload of discoveryPayloads()) {
      const session = await row("discovery_sessions", ids.discovery, "lock_version");
      await ownerApi(`/api/discovery-sessions/${ids.discovery}`, "PATCH", {
        lockVersion: session.lock_version,
        payload,
      });
    }
    await ownerApi(`/api/discovery-sessions/${ids.discovery}/validate`, "POST");
    assert.equal((await row("discovery_sessions", ids.discovery, "status")).status, "validated");
  });
  await stage("Interview", async () => {
    let view = await ownerApi(`/api/companies/${companyId}/interviews`, "POST");
    ids.interview = await latest("interview_sessions");
    for (let i = 0; i < 80; i++) {
      if (view.progress?.readyForProcessMapping || view.session?.status === "completed") break;
      const question = nextQuestion(view);
      if (!question) break;
      const session = await row("interview_sessions", ids.interview, "lock_version");
      view = await ownerApi(`/api/interviews/${ids.interview}/answer`, "POST", {
        lockVersion: session.lock_version,
        questionId: question.id,
        value: answerFor(question),
        confidence: "confirmed",
      });
    }
    await ownerApi(`/api/interviews/${ids.interview}/complete`, "POST");
    await ownerApi(`/api/interviews/${ids.interview}/validate`, "POST");
    const persisted = await row("interview_sessions", ids.interview, "status,discovery_session_id");
    assert.ok(["validated", "completed"].includes(persisted.status));
    assert.equal(persisted.discovery_session_id, ids.discovery);
  });
  await stage("Enterprise Knowledge", async () => {
    await ownerApi(`/api/companies/${companyId}/knowledge-snapshots`, "POST");
    ids.knowledge = await latest("knowledge_snapshots");
    assert.equal((await row("knowledge_snapshots", ids.knowledge, "status")).status, "ready");
    for (const table of ["knowledge_sources", "knowledge_facts", "knowledge_nodes"]) {
      const result = await admin
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("snapshot_id", ids.knowledge);
      assert.equal(result.error, null, `${table} readback unavailable`);
      assert.ok(result.count > 0, `${table} empty`);
    }
  });
  await stage("Process Map", async () => {
    await ownerApi(`/api/knowledge-snapshots/${ids.knowledge}/process-maps`, "POST");
    const pattern = await admin
      .from("process_patterns")
      .select("id")
      .eq("code", "invoice_processing")
      .order("version", { ascending: false })
      .limit(1)
      .single();
    assert.equal(pattern.error, null, "invoice pattern unavailable");
    const maps = await admin
      .from("process_maps")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("company_id", companyId)
      .eq("process_pattern_id", pattern.data.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    assert.equal(maps.error, null, "invoice map unavailable");
    ids.processMap = maps.data.id;
    await publish("process-maps", "process_maps", ids.processMap);
  });
  const downstream = [
    [
      "Business Analysis",
      "analysis",
      "analysis_snapshots",
      () => `/api/process-maps/${ids.processMap}/analyze`,
    ],
    [
      "AI Opportunities",
      "ai-opportunities",
      "ai_opportunity_snapshots",
      () => `/api/business-analysis/${ids.analysis}/ai-opportunities`,
    ],
    [
      "Automation Opportunities",
      "automation-opportunities",
      "automation_opportunity_snapshots",
      () => `/api/ai-opportunities/${ids["ai-opportunities"]}/automation-opportunities`,
    ],
    [
      "ROI",
      "roi",
      "roi_evaluation_snapshots",
      () => `/api/automation-opportunities/${ids["automation-opportunities"]}/roi`,
    ],
    [
      "Recommendation Portfolio",
      "recommendations",
      "recommendation_portfolio_snapshots",
      () => `/api/roi/${ids.roi}/recommendations`,
    ],
    [
      "Solution Blueprint",
      "solution-blueprints",
      "solution_blueprints",
      () => `/api/recommendations/${ids.recommendation}/solution-blueprints`,
    ],
    [
      "Automation Specification",
      "automation-specifications",
      "automation_specifications",
      () => `/api/solution-blueprints/${ids["solution-blueprints"]}/automation-specifications`,
    ],
  ];
  for (const [name, route, table, path] of downstream) {
    await stage(name, async () => {
      const body =
        route === "roi"
          ? {
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
            }
          : undefined;
      await ownerApi(path(), "POST", body);
      ids[route] =
        route === "automation-specifications"
          ? await latest(table, "solution_blueprint_id", ids["solution-blueprints"])
          : await latest(table);
      await publish(route, table, ids[route]);
      if (route === "recommendations") {
        const result = await admin
          .from("transformation_recommendations")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("snapshot_id", ids[route])
          .order("priority_score", { ascending: false })
          .order("created_at")
          .order("id")
          .limit(1)
          .single();
        assert.equal(result.error, null, "recommendation missing");
        ids.recommendation = result.data.id;
      }
    });
  }
  await stage("Executive Result", async () => {
    const result = await ownerApi(`/api/companies/${companyId}/automation-audit/decision-center`);
    const center = result.decisionCenter ?? result;
    assert.equal(center.status, "READY");
    assert.equal(center.completeness?.status, "YES");
    assert.ok(center.priorityCards?.length > 0);
    evidence.canonical.executive = {
      status: center.status,
      completeness: center.completeness.status,
      cards: center.priorityCards.length,
    };
  });
  evidence.canonical.currentStage = "Economic readback";
  const scenario = await admin
    .from("roi_scenarios")
    .select("id,model_id")
    .eq("organization_id", organizationId)
    .eq("snapshot_id", ids.roi)
    .eq("type", "expected")
    .single();
  assert.equal(scenario.error, null, "expected scenario unavailable");
  const model = await admin
    .from("roi_model_catalog")
    .select("version")
    .eq("id", scenario.data.model_id)
    .single();
  assert.equal(model.error, null, "ROI model unavailable");
  assert.equal(model.data.version, 2, "new savings-basis catalog not selected");
  const metrics = await admin
    .from("roi_metrics")
    .select("value,evaluation_id")
    .eq("organization_id", organizationId)
    .eq("snapshot_id", ids.roi)
    .eq("scenario_id", scenario.data.id)
    .eq("code", "annual_hours_saved");
  assert.equal(metrics.error, null, "saved-hours metrics unavailable");
  assert.ok(metrics.data.length > 0);
  for (const metric of metrics.data)
    assert.equal(Number(metric.value), 459, "coverage must not be a time-saving multiplier");
  const evaluations = await admin
    .from("roi_evaluations")
    .select("confidence,automation_opportunity_id")
    .eq("organization_id", organizationId)
    .eq("snapshot_id", ids.roi)
    .eq("scenario_id", scenario.data.id);
  assert.equal(evaluations.error, null, "ROI evaluations unavailable");
  for (const evaluation of evaluations.data) {
    const opportunity = await row(
      "automation_opportunities",
      evaluation.automation_opportunity_id,
      "confidence",
    );
    assert.ok(
      Number(evaluation.confidence) <= Number(opportunity.confidence),
      "ROI confidence must not be uplifted",
    );
  }
  evidence.canonical.economics = {
    modelVersion: 2,
    annualHoursSavedPerOpportunity: 459,
    evaluations: evaluations.data.length,
    confidenceUplift: false,
    sharedAssumptions: "NON_ADDITIVE",
  };
  evidence.results.push("persisted ROI savings basis and bounded confidence: PASS");
  evidence.canonical.currentStage = "Populated tenant isolation";
  for (const route of [
    "process-maps",
    "analysis",
    "ai-opportunities",
    "automation-opportunities",
    "roi",
    "recommendations",
    "solution-blueprints",
    "automation-specifications",
  ]) {
    const id = route === "process-maps" ? ids.processMap : ids[route];
    await api(pages[1], `/api/${route}/${id}`, "GET", undefined, [404]);
    await api(pages[1], `/api/${route}/${id}/validate`, "POST", { lockVersion: 1 }, [404]);
  }
  await api(
    pages[1],
    `/api/companies/${companyId}/automation-audit/results`,
    "GET",
    undefined,
    [404],
  );
  await api(
    pages[1],
    `/api/companies/${companyId}/automation-audit/decision-center`,
    "GET",
    undefined,
    [404],
  );
  evidence.results.push("populated canonical artifacts: tenant B read/write isolation PASS");
  await pages[0].goto(`${evidence.preview}/companies/${companyId}/automation-audit/results`);
  await pages[0].reload();
  const persisted = await ownerApi(`/api/companies/${companyId}/automation-audit/decision-center`);
  assert.equal(persisted.decisionCenter?.status, "READY");
  evidence.results.push("canonical results persistence after UI refresh: PASS");
  evidence.fullCanonicalJourney = "PASS_12_OF_12";
}
