# Adaptive Interview Engine

Sprint 5 introduces the second Enterprise Intelligence bounded context. Interview consumes the
latest validated Discovery session and never copies or mutates canonical company profile data.

## Deterministic adaptation

The versioned question catalogue stores a domain, type, weight, sequence, validation constraints
and a JSON condition. The v1 condition operators are `equal`, `contains`, and `exists`; facts come
only from the validated Discovery projection or previously validated interview answers.
Follow-up questions are ordinary catalogued questions whose conditions reference an answer fact.
No LLM or network call participates in question selection.

The system seed contains 20 questions across company, operations, finance, software and HR,
including generic, restaurant, construction, and invoice follow-up paths. Organizations may
extend the catalogue; system questions remain read-only.

## Lifecycle and permissions

Sessions follow `draft → in_progress → completed → validated`, with `archived` retained for future
administrative lifecycle work. A validated Discovery is mandatory and one active interview is
allowed per company. Autosave mutations use `lock_version` and stale writes return HTTP 409.

Owners, admins and consultants conduct interviews. Owners and admins validate completed
interviews. Viewers have read-only access. Prisma always runs inside the authenticated Supabase
RLS transaction.

## Progress, confidence, readiness

Progress is answered mandatory weight divided by eligible mandatory weight. Confidence uses
factors: validated/confirmed `1`, uncertain `0.5`, missing `0`. A session is ready for Process
Mapping when every eligible mandatory item is answered and overall confidence is at least 80%.
The same metrics are persisted by domain in `interview_progress`.

## API and UI

- `POST /api/companies/:id/interviews`
- `GET /api/interviews/:id`
- `POST /api/interviews/:id/answer`
- `POST /api/interviews/:id/skip`
- `POST /api/interviews/:id/back`
- `POST /api/interviews/:id/complete`
- `POST /api/interviews/:id/validate`
- Wizard: `/companies/:id/interview`

Controllers validate input and delegate to `InterviewService`; adaptive decisions remain in
`InterviewEngine`.
