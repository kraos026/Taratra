import { RoiEngine } from "../../roi/domain/roi";
import { PrioritizationEngine, type Difficulty } from "../domain/prioritization-engine";
export type RecommendationCandidate = {
  id: string;
  code: string;
  difficulty: Difficulty;
  hoursMonth: number;
  implementationCost: number;
  additionalAnnualSavings: number;
  rulePriority: number;
};
export class RecommendationEngine {
  constructor(
    private readonly roi = new RoiEngine(),
    private readonly prioritization = new PrioritizationEngine(),
  ) {}
  evaluate(candidates: readonly RecommendationCandidate[], hourlyCost: number) {
    return this.prioritization.sort(
      candidates.map((candidate) => {
        const roi = this.roi.calculate({
          hoursMonth: candidate.hoursMonth,
          hourlyCost,
          implementationCost: candidate.implementationCost,
          additionalAnnualSavings: candidate.additionalAnnualSavings,
        });
        const priority = this.prioritization.classify(roi.roiPercentage, candidate.difficulty);
        return {
          ...candidate,
          ...roi,
          priority,
          quickWin: priority === "quick_win",
          strategic: priority === "strategic",
        };
      }),
    );
  }
}
