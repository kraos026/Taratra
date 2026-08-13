import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  WorkActivityId,
  WorkActivityLineageId,
  WorkActivityVersion,
} from "./domain/work-intelligence";
import {
  WorkAutomationHypothesisEngine,
  WorkPatternEngine,
  qualifyAutomationCandidate,
} from "./domain/work-intelligence";
import { PrismaWorkActivityRepository } from "./infrastructure/prisma-work-activity-repository";

describe("Work Intelligence M2 persistence contract", () => {
  it("accepts UUID value objects and rejects legacy text identifiers", () => {
    expect(WorkActivityId.create("51000000-0000-4000-8000-000000000001").value).toBe(
      "51000000-0000-4000-8000-000000000001",
    );
    expect(WorkActivityLineageId.create("51000000-0000-4000-8000-000000000002").value).toBe(
      "51000000-0000-4000-8000-000000000002",
    );
    expect(WorkActivityVersion.create(1).value).toBe(1);
    expect(() => WorkActivityId.create("legacy-a1")).toThrow("UUID");
    expect(() => WorkActivityVersion.create(0)).toThrow("version");
  });

  it("does not define production persistence for derived artifacts", () => {
    const source = [
      WorkPatternEngine.name,
      WorkAutomationHypothesisEngine.name,
      String(qualifyAutomationCandidate),
    ].join("\n");
    expect(source).not.toMatch(/Prisma|Repository|persist/i);
    expect(PrismaWorkActivityRepository.name).toBe("PrismaWorkActivityRepository");
  });

  it("keeps employee scoring concepts absent from persistence contract vocabulary", () => {
    const forbidden = [
      "employeeProductivityScore",
      "employeeRanking",
      "disciplinaryScore",
      "performanceRanking",
    ];
    const source = readFileSync(
      join(
        process.cwd(),
        "src/modules/work-intelligence/infrastructure/prisma-work-activity-repository.ts",
      ),
      "utf8",
    );
    expect(source).not.toMatch(new RegExp(forbidden.join("|")));
  });
});
