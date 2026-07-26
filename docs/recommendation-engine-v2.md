# Recommendation Engine — Sprint 11

Sprint 11 is separate from the legacy recommendation v1. It consumes the published Sprint 10 ROI snapshot and its exact published Automation Opportunity, AI Opportunity, Business Analysis, and Process Map versions. It never reads Discovery or Interview and never recalculates ROI.

The expected ROI scenario is the decision basis. Conservative and optimistic scenarios remain supporting bounds. Priority is: ROI 30%, Business Impact 25%, Technical Feasibility 15%, inverse Complexity 10%, Operational Risk 10%, Confidence 10%. ROI normalization is `clamp((ROI + 100) / 4, 0, 100)`; unbounded ROI is 100. Priority thresholds are Critical 85, High 70, Medium 50, Low 30, Future 0.

Category precedence is Quick Wins, Compliance, Risk Reduction, AI First, Automation First, Strategic Projects, High ROI, Low Investment, Operational Excellence, Long Term. Low Investment uses the portfolio median in its single currency.

Dependencies come only from versioned rules. Topological depth assigns phases 1–4; unknown dependencies and cycles block publication. Rebuild creates a new draft. Published portfolios and catalogs are immutable. Consultants, admins, and owners generate and validate; only admins and owners publish; viewers are read-only.

API: `POST /api/roi/:id/recommendations`, lifecycle under `/api/recommendations/:id`, and `GET /api/companies/:id/recommendations`. The read-only roadmap is `/recommendations/:id`.
