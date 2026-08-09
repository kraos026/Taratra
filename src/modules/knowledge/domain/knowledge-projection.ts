import type { WorkActivity } from "@/modules/work-intelligence/domain/work-intelligence";

export type KnowledgeSourceType = "discovery" | "interview" | "work_intelligence";

export interface KnowledgeSourceInput {
  key: string;
  type: KnowledgeSourceType;
  sourceId: string;
  version: number;
  validatedAt: Date;
}

export interface KnowledgeNodeProjection {
  key: string;
  type: string;
  domain: string;
  label: string;
  canonicalEntityType: string;
  canonicalEntityId: string;
  confidence: number;
}

export interface KnowledgeFactProjection {
  key: string;
  nodeKey: string | null;
  domain: string;
  value: unknown;
  valueType: "string" | "number" | "boolean" | "string_array" | "object";
  confidence: number;
  sourceKey: string;
  sourceRecordType: string;
  sourceRecordId: string;
  evidenceType:
    "validated_entity" | "validated_answer" | "confirmed_work_activity" | "corrected_work_activity";
}

export interface KnowledgeRelationshipProjection {
  fromNodeKey: string;
  toNodeKey: string;
  type: string;
  confidence: number;
}

export interface DiscoveryKnowledgeInput {
  session: { id: string; version: number; validatedAt: Date };
  profile: {
    companyId: string;
    industry: string | null;
    countryCode: string | null;
    employeeCount: number | null;
    businessModel: string | null;
    growthStage: string | null;
  };
  departments: { id: string; name: string; headcount: number | null }[];
  roles: { id: string; departmentId: string | null; title: string; headcount: number }[];
  software: { id: string; name: string; purpose: string | null; criticality: number | null }[];
  processes: {
    id: string;
    name: string;
    frequency: string | null;
    manualHoursMonth: number | null;
  }[];
}

export interface InterviewKnowledgeInput {
  session: { id: string; version: number; validatedAt: Date };
  answers: {
    id: string;
    code: string;
    domain: string;
    value: unknown;
    confidence: "validated" | "confirmed" | "uncertain" | "missing";
  }[];
}

export interface KnowledgeProjection {
  sources: KnowledgeSourceInput[];
  nodes: KnowledgeNodeProjection[];
  facts: KnowledgeFactProjection[];
  relationships: KnowledgeRelationshipProjection[];
}

export class EnterpriseKnowledgeProjector {
  project(
    discovery: DiscoveryKnowledgeInput,
    interview: InterviewKnowledgeInput | null,
  ): KnowledgeProjection {
    const discoverySource = "discovery";
    const sources: KnowledgeSourceInput[] = [
      {
        key: discoverySource,
        type: "discovery",
        sourceId: discovery.session.id,
        version: discovery.session.version,
        validatedAt: discovery.session.validatedAt,
      },
    ];
    if (interview)
      sources.push({
        key: "interview",
        type: "interview",
        sourceId: interview.session.id,
        version: interview.session.version,
        validatedAt: interview.session.validatedAt,
      });

    const companyNode: KnowledgeNodeProjection = {
      key: `company:${discovery.profile.companyId}`,
      type: "company",
      domain: "company",
      label: "Company",
      canonicalEntityType: "company_profile",
      canonicalEntityId: discovery.profile.companyId,
      confidence: 100,
    };
    const nodes: KnowledgeNodeProjection[] = [
      companyNode,
      ...discovery.departments.map((department) =>
        node("department", "organization", department.id, department.name),
      ),
      ...discovery.roles.map((role) => node("role", "organization", role.id, role.title)),
      ...discovery.software.map((software) =>
        node("software", "software", software.id, software.name),
      ),
      ...discovery.processes.map((process) =>
        node("process", "operations", process.id, process.name),
      ),
    ];

    const facts: KnowledgeFactProjection[] = [];
    const profileValues = {
      industry: discovery.profile.industry,
      country_code: discovery.profile.countryCode,
      employee_count: discovery.profile.employeeCount,
      business_model: discovery.profile.businessModel,
      growth_stage: discovery.profile.growthStage,
    };
    for (const [name, value] of Object.entries(profileValues))
      if (value !== null)
        facts.push(
          fact(
            `company.${name}`,
            companyNode.key,
            "company",
            value,
            discoverySource,
            "company_profile",
            discovery.profile.companyId,
            "validated_entity",
            100,
          ),
        );

    for (const department of discovery.departments) {
      if (department.headcount !== null)
        facts.push(
          fact(
            `department:${department.id}.headcount`,
            `department:${department.id}`,
            "organization",
            department.headcount,
            discoverySource,
            "department",
            department.id,
            "validated_entity",
            100,
          ),
        );
    }
    for (const software of discovery.software) {
      if (software.purpose)
        facts.push(
          fact(
            `software:${software.id}.purpose`,
            `software:${software.id}`,
            "software",
            software.purpose,
            discoverySource,
            "company_software",
            software.id,
            "validated_entity",
            100,
          ),
        );
      if (software.criticality !== null)
        facts.push(
          fact(
            `software:${software.id}.criticality`,
            `software:${software.id}`,
            "software",
            software.criticality,
            discoverySource,
            "company_software",
            software.id,
            "validated_entity",
            100,
          ),
        );
    }
    for (const process of discovery.processes) {
      if (process.frequency)
        facts.push(
          fact(
            `process:${process.id}.frequency`,
            `process:${process.id}`,
            "operations",
            process.frequency,
            discoverySource,
            "business_process",
            process.id,
            "validated_entity",
            100,
          ),
        );
      if (process.manualHoursMonth !== null)
        facts.push(
          fact(
            `process:${process.id}.manual_hours_month`,
            `process:${process.id}`,
            "operations",
            process.manualHoursMonth,
            discoverySource,
            "business_process",
            process.id,
            "validated_entity",
            100,
          ),
        );
    }
    if (interview)
      for (const answer of interview.answers)
        if (answer.value !== null && answer.confidence !== "missing")
          facts.push(
            fact(
              `interview.${answer.code}`,
              companyNode.key,
              answer.domain,
              answer.value,
              "interview",
              "interview_answer",
              answer.id,
              "validated_answer",
              answer.confidence === "uncertain" ? 50 : 100,
            ),
          );

    const relationships: KnowledgeRelationshipProjection[] = [
      ...discovery.departments.map((department) => ({
        fromNodeKey: companyNode.key,
        toNodeKey: `department:${department.id}`,
        type: "has_department",
        confidence: 100,
      })),
      ...discovery.software.map((software) => ({
        fromNodeKey: companyNode.key,
        toNodeKey: `software:${software.id}`,
        type: "uses_software",
        confidence: 100,
      })),
      ...discovery.processes.map((process) => ({
        fromNodeKey: companyNode.key,
        toNodeKey: `process:${process.id}`,
        type: "performs_process",
        confidence: 100,
      })),
      ...discovery.roles
        .filter((role) => role.departmentId !== null)
        .map((role) => ({
          fromNodeKey: `department:${role.departmentId}`,
          toNodeKey: `role:${role.id}`,
          type: "has_role",
          confidence: 100,
        })),
    ];
    return { sources, nodes, facts, relationships };
  }
}

export class WorkIntelligenceKnowledgeProjector {
  project(activity: WorkActivity, projectedAt: Date): KnowledgeProjection {
    const sourceKey = `work_intelligence:${activity.lineageId}:${activity.version}`;
    const nodeKey = `work_activity:${activity.activityId}`;
    return {
      sources: [
        {
          key: sourceKey,
          type: "work_intelligence",
          sourceId: activity.lineageId,
          version: activity.version,
          validatedAt: projectedAt,
        },
      ],
      nodes: [
        {
          key: nodeKey,
          type: "work_activity",
          domain: "operations",
          label: activity.normalizedActivity,
          canonicalEntityType: "work_activity_version",
          canonicalEntityId: activity.activityId,
          confidence: activity.confidence,
        },
      ],
      facts: [
        fact(
          `work_activity:${activity.activityId}.normalized_activity`,
          nodeKey,
          "operations",
          activity.normalizedActivity,
          sourceKey,
          "work_activity_version",
          activity.activityId,
          evidenceType(activity),
          activity.confidence,
        ),
        fact(
          `work_activity:${activity.activityId}.category`,
          nodeKey,
          "operations",
          activity.category,
          sourceKey,
          "work_activity_version",
          activity.activityId,
          evidenceType(activity),
          activity.confidence,
        ),
        fact(
          `work_activity:${activity.activityId}.duration_minutes`,
          nodeKey,
          "operations",
          activity.durationMinutes,
          sourceKey,
          "work_activity_version",
          activity.activityId,
          evidenceType(activity),
          activity.confidence,
        ),
        fact(
          `work_activity:${activity.activityId}.tools`,
          nodeKey,
          "software",
          activity.tools,
          sourceKey,
          "work_activity_version",
          activity.activityId,
          evidenceType(activity),
          activity.confidence,
        ),
      ],
      relationships: [],
    };
  }
}

function node(type: string, domain: string, id: string, label: string): KnowledgeNodeProjection {
  return {
    key: `${type}:${id}`,
    type,
    domain,
    label,
    canonicalEntityType: type,
    canonicalEntityId: id,
    confidence: 100,
  };
}

function fact(
  key: string,
  nodeKey: string | null,
  domain: string,
  value: unknown,
  sourceKey: string,
  sourceRecordType: string,
  sourceRecordId: string,
  evidenceType: KnowledgeFactProjection["evidenceType"],
  confidence: number,
): KnowledgeFactProjection {
  return {
    key,
    nodeKey,
    domain,
    value,
    valueType: valueType(value),
    confidence,
    sourceKey,
    sourceRecordType,
    sourceRecordId,
    evidenceType,
  };
}

function evidenceType(
  activity: WorkActivity,
): "confirmed_work_activity" | "corrected_work_activity" {
  return activity.confirmationState === "CORRECTED"
    ? "corrected_work_activity"
    : "confirmed_work_activity";
}

function valueType(value: unknown): KnowledgeFactProjection["valueType"] {
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (Array.isArray(value) && value.every((item) => typeof item === "string"))
    return "string_array";
  return "object";
}
