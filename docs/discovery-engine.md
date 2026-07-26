# Discovery Engine

Discovery is the first bounded context of the Enterprise Intelligence Engine. It builds a reusable company profile before interviews begin. The normalized profile, organization, software, process, objective and challenge tables are the canonical reusable data. `discovery_answers` preserves the versioned collection snapshot and field provenance.

Sessions follow `draft → in_progress → completed → validated`; archived sessions are retained. A company has at most one active collection session. Every autosave supplies `lockVersion`; stale writes return HTTP 409 rather than overwriting newer work. Owners, admins and consultants can collect and validate. Viewers have read-only access. All server access runs through Prisma inside the authenticated Supabase RLS transaction.

System software/process categories are shared read-only defaults. Organizations may extend them without changing the system catalogue. Free-text business models and growth stages are intentionally captured as data, not hardcoded rules; future controlled catalogues can be introduced without migrating historical answers.

Endpoints: `POST|GET /api/companies/:id/discovery`, `GET|PATCH /api/discovery-sessions/:id`, and `POST /api/discovery-sessions/:id/validate`. The wizard is `/companies/:id/discovery`.

Future engines must consume normalized Discovery entities. They must not duplicate Discovery data or derive authorization from user-editable JWT metadata.

The legacy `companies.employee_count` and `companies.sector_id` fields are compatibility debt, not
alternative sources. New engines read `company_profiles.employee_count` and
`company_profiles.industry`. The planned migration/backfill must be approved separately because it
changes existing API and UI contracts.
