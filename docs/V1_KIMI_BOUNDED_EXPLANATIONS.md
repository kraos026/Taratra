# V1 — optional bounded educational support

Status: EXPERIMENTAL, disabled by default. Not Brain V2 promotion, not a new decision engine.

Owner: existing Ask Optivos / canonical Executive Decision projection. Authentication and tenant-scoped loading occur before the optional selector. The canonical answer and all authoritative fields remain unchanged; a separate educational section may be added.

The provider can select up to three approved topic IDs only. All displayed educational sentences are application-owned French copy. Free-text provider output, unknown IDs, duplicates, extra output fields, truncated answers and tool calls are rejected. No company IDs, tenant IDs, questions, source text or economic values are sent. No database write, recalculation, approval or automation execution occurs.

## Configuration — local or explicitly scoped Preview only

- `OPTIVOS_KIMI_EXPLANATIONS_ENABLED`: absent/false by default; explicit `true` required.
- `OPTIVOS_KIMI_API_KEY`: server secret; never `NEXT_PUBLIC_`, committed, logged or shared in chat.
- `OPTIVOS_KIMI_MODEL`: explicit supported `kimi-*` model ID required; model compatibility must be verified in a controlled live test.

Vercel Production is blocked regardless of the flag. Do not configure a Preview backed by Production. This implementation does not install any secret or modify any remote environment.

One HTTP attempt, four-second timeout, max 128 output tokens. Five attempts per tenant per hour **per warm server process**, bounded map capacity. This is NOT a distributed spending ceiling: serverless instances and cold starts have separate counters. Configure a provider-side budget and proper distributed limits before any broader rollout. No retry. Any failure returns the canonical response unchanged.

## Validation and limitations

Mocked tests prove payload minimization, exact canonical-field preservation, disabled/Production guards, malformed-output rejection and fallback. They do not prove live provider availability, latency, French-language quality across all existing answer bodies or production readiness. The main canonical answer is not translated or freely rewritten by this selector.

Next gates: exact-SHA local canonical certification; controlled synthetic live call with an approved secret and spending cap; Preview pilot; source grounding / prompt-injection / tenant isolation review. Keep disabled until these gates pass. Do not substitute a synthetic historical Brain benchmark PASS for live certification.

API reference: https://platform.kimi.ai/docs/api/chat (official Chat Completions documentation).
