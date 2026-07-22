# Executive report layer

`GET /api/audits/:id/report` returns the `AuditReport` prepared by `ReportBuilder`. The builder reads persisted rule scores and recommendation/ROI results through Prisma under the authenticated Supabase RLS context. It never evaluates rules or recalculates recommendation ROI.

The maturity label comes directly from the `general.digital_maturity` audit answer. Score colors use the presentation thresholds approved for Sprint 3B.2. Strengths are blue/green categories and risks are red/orange categories. Top recommendations preserve the deterministic priority order stored by Sprint 3B.1.

Totals are aggregations of persisted recommendation results. Monthly hours and currency are snapshots stored in recommendation metadata when evaluation runs. Older evaluations without these snapshots display an unavailable state and must be regenerated; the report does not infer missing business values.

The report page is `/audits/:id/report`. Its charts are display-only projections of `AuditReport`, making the same JSON object reusable by Sprint 4 PDF rendering.
