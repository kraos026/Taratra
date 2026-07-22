export function calculateProgress(totalQuestions: number, validAnswers: number): number {
  if (totalQuestions <= 0) return 0;
  return Math.round((Math.min(validAnswers, totalQuestions) / totalQuestions) * 100);
}
