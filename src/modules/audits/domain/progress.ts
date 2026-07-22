export function calculateProgress(totalQuestions: number, validAnswers: number): number {
  if (totalQuestions <= 0) return 0;
  return Math.round((Math.min(validAnswers, totalQuestions) / totalQuestions) * 100);
}

export function evaluateCompletion(
  allQuestionIds: readonly string[],
  requiredQuestionIds: readonly string[],
  answeredQuestionIds: ReadonlySet<string>,
) {
  return {
    canComplete: requiredQuestionIds.every((id) => answeredQuestionIds.has(id)),
    progress: calculateProgress(
      allQuestionIds.length,
      allQuestionIds.filter((id) => answeredQuestionIds.has(id)).length,
    ),
  };
}
