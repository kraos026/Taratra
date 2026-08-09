import { describe, expect, it } from "vitest";
import { readFrozenAssumptions } from "./prisma-roi-evaluation-repository";

describe("ROI frozen assumption provenance", () => {
  it("restores known zero and unknown as distinct values", () => {
    expect(
      readFrozenAssumptions({
        assumptionInputs: [
          { code: "maintenance_cost", status: "known", value: 0 },
          { code: "training_cost", status: "unknown" },
        ],
      }),
    ).toEqual({
      suppliedAssumptions: { maintenance_cost: 0 },
      unknownAssumptions: ["training_cost"],
    });
  });

  it("rejects malformed or unknown frozen assumption records", () => {
    expect(
      readFrozenAssumptions({
        assumptionInputs: [{ code: "not_a_real_assumption", status: "unknown" }],
      }),
    ).toBeNull();
    expect(
      readFrozenAssumptions({
        assumptionInputs: [{ code: "maintenance_cost", status: "known" }],
      }),
    ).toBeNull();
  });
});
