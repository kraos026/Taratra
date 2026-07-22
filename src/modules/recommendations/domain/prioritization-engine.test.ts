import { describe, expect, it } from "vitest";
import { PrioritizationEngine, roiBand } from "./prioritization-engine";
describe("PrioritizationEngine", () => {
  const e = new PrioritizationEngine();
  it.each([
    [-1, "negative"],
    [0, "low"],
    [49, "low"],
    [50, "medium"],
    [150, "medium"],
    [151, "high"],
  ])("bands %s", (roi, band) => expect(roiBand(roi)).toBe(band));
  it("classifies a quick win", () => expect(e.classify(151, "low")).toBe("quick_win"));
  it("classifies strategic work", () => expect(e.classify(151, "medium")).toBe("strategic"));
  it("classifies medium ROI", () => expect(e.classify(50, "very_high")).toBe("nice_to_have"));
  it("classifies low ROI", () => expect(e.classify(49, "very_low")).toBe("low_priority"));
  it("sorts with stable business tie breakers", () =>
    expect(
      e
        .sort([
          { code: "B", roiPercentage: 100, hoursYear: 20, rulePriority: 1 },
          { code: "A", roiPercentage: 100, hoursYear: 20, rulePriority: 1 },
        ])
        .map((x) => x.code),
    ).toEqual(["A", "B"]));
});
