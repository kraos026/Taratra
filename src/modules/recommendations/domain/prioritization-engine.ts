export type Difficulty = "very_low" | "low" | "medium" | "high" | "very_high";
export type PriorityClass = "quick_win" | "strategic" | "nice_to_have" | "low_priority";
const effort: Record<Difficulty, number> = {
  very_low: 1,
  low: 2,
  medium: 3,
  high: 4,
  very_high: 5,
};
export function roiBand(roi: number) {
  return roi < 0 ? "negative" : roi < 50 ? "low" : roi <= 150 ? "medium" : "high";
}
export class PrioritizationEngine {
  classify(roi: number, difficulty: Difficulty): PriorityClass {
    const band = roiBand(roi);
    if (band === "high") return effort[difficulty] <= 2 ? "quick_win" : "strategic";
    if (band === "medium") return "nice_to_have";
    return "low_priority";
  }
  sort<T extends { roiPercentage: number; hoursYear: number; rulePriority: number; code: string }>(
    items: readonly T[],
  ) {
    return [...items].sort(
      (a, b) =>
        b.roiPercentage - a.roiPercentage ||
        b.hoursYear - a.hoursYear ||
        a.rulePriority - b.rulePriority ||
        a.code.localeCompare(b.code),
    );
  }
}
