export class RecommendationPortfolioError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
export class RecommendationPortfolioNotFoundError extends RecommendationPortfolioError {
  constructor() {
    super("RECOMMENDATION_PORTFOLIO_NOT_FOUND", "Recommendation portfolio not found", 404);
  }
}
export class RecommendationPortfolioForbiddenError extends RecommendationPortfolioError {
  constructor() {
    super("RECOMMENDATION_PORTFOLIO_FORBIDDEN", "Insufficient permissions", 403);
  }
}
export class RecommendationPortfolioConflictError extends RecommendationPortfolioError {
  constructor() {
    super("RECOMMENDATION_PORTFOLIO_CONFLICT", "Portfolio was modified by another request", 409);
  }
}
export class RecommendationPortfolioValidationError extends RecommendationPortfolioError {
  constructor(message: string) {
    super("RECOMMENDATION_PORTFOLIO_INVALID", message, 422);
  }
}
