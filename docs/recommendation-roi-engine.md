# Recommendation and ROI engine (MVP)

> Architecture status: this is a pre-existing deterministic v1 implementation. It remains
> operational, but it is not the completion of the official Sprint 10 ROI Engine or Sprint 11
> Recommendation Engine. It must not be expanded before an ADR decides whether to migrate, adapt,
> or replace it using Discovery and the intervening engine contracts.

The engine is deterministic and performs no network call or currency conversion. Every monetary value remains in the selected profile currency.

## Configurable assumptions

The eight system ROI profiles and the 30 recommendation impacts are demonstration defaults, not official economic references. Owners and admins can create organization-specific profiles; system defaults remain immutable. Recommendation impact metadata uses `assumptionType: mvp_demo` and `configurable: true` so definitive business values can replace them later.

`hours_year = hours_month × 12`; `annual_savings = hours_year × hourly_cost + additional_annual_savings`; `ROI = ((annual_savings - implementation_cost) / implementation_cost) × 100`; `payback_months = implementation_cost / monthly_savings`.

ROI bands are Negative (<0), Low (0..<50), Medium (50..150), and High (>150). High ROI with difficulty 1–2 is a Quick Win; High ROI with difficulty 3–5 is Strategic; Medium is Nice to Have; Low or Negative is Low Priority. Ordering is ROI descending, annual saved hours descending, rule priority ascending, then recommendation code.

System profiles: Madagascar (MGA 15000), France (EUR 35), Canada (CAD 45), Belgium (EUR 40), Switzerland (CHF 65), Luxembourg (EUR 55), USA (USD 50), UK (GBP 38). All use 220 working days; daily hours are respectively 8, 7.5, 8, 7.6, 8, 8, 8, and 7.5.
