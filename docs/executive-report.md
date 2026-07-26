# Executive report layer

`GET /api/audits/:id/report` returns the `AuditReport` prepared by `ReportBuilder`. The builder reads persisted rule scores and recommendation/ROI results through Prisma under the authenticated Supabase RLS context. It never evaluates rules or recalculates recommendation ROI.

The maturity label comes directly from the `general.digital_maturity` audit answer. Score colors
use the thresholds approved for the v1 report. Strengths are blue/green categories and risks are
red/orange categories. Top recommendations preserve the deterministic priority order stored by
the pre-existing Recommendation Engine v1.

Totals are aggregations of persisted recommendation results. Monthly hours and currency are snapshots stored in recommendation metadata when evaluation runs. Older evaluations without these snapshots display an unavailable state and must be regenerated; the report does not infer missing business values.

The report page is `/audits/:id/report`. Its charts are display-only projections of `AuditReport`.
This is the v1 restitution layer. Sprint 12 Executive Report v2 will consume the persisted outputs
of the official engine chain; PDF generation is not assigned to the current Sprint 4.
