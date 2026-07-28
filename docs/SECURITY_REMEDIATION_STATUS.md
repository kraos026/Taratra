# AutomateX Security Remediation Status

Status: **In Progress**

Updated: 2026-07-28  
Integration branch: `baseline/automatex-platform-v1`

## Completed

The Prisma development-tooling family has been corrected without a schema or migration change:

| Package              |  Before |       After | Result                     |
| -------------------- | ------: | ----------: | -------------------------- |
| `prisma`             |   7.8.0 |       7.9.1 | Corrected                  |
| `@prisma/client`     |   7.8.0 |       7.9.1 | Aligned with Prisma        |
| `@prisma/adapter-pg` |   7.8.0 |       7.9.1 | Aligned with Prisma        |
| `@prisma/dev`        |  0.24.3 |     0.24.17 | Corrected transitively     |
| `valibot`            |   1.2.0 |       1.4.2 | Corrected transitively     |
| `@hono/node-server`  | 1.19.11 | Not present | Vulnerable path eliminated |

Evidence after the change:

- `npm audit --omit=dev`: 0 vulnerabilities;
- full `npm audit`: 9 High, 0 Medium, 0 Critical;
- Prisma Client generation: pass;
- lint and format: pass;
- typecheck: pass;
- Vitest: 71 files and 320 tests pass;
- production build: pass.

## Blocked

The nine remaining findings are all in the ESLint/Next.js development-only lint chain:

- `eslint`;
- `@eslint/config-array`;
- `@eslint/eslintrc`;
- `minimatch`;
- `brace-expansion`;
- `eslint-config-next`;
- `eslint-plugin-import`;
- `eslint-plugin-jsx-a11y`;
- `eslint-plugin-react`.

The registry currently exposes no safe compatible dependency graph:

1. npm proposes ESLint 10.8.0 for the ESLint-owned paths;
2. the current Next.js plugins declare ESLint peer support only through version 9;
3. the current plugin releases still depend on `minimatch ^3.1.2`;
4. no corrected minimatch 3.x release exists;
5. forcing brace-expansion 5.x into minimatch 3.x would cross a major version without upstream
   compatibility;
6. npm's suggested `eslint-config-next` downgrade is incompatible with Next.js 16.

Therefore no ESLint mutation was applied. `--force`, `--legacy-peer-deps`, rule removal, an unsafe
override or a Next.js configuration downgrade would create an invalid or unreviewed toolchain and
would not constitute remediation.

### Rejected compatibility override

An override of `brace-expansion` to the corrected 5.0.8 release was tested and rejected before
commit:

- npm resolved every vulnerable path to 5.0.8;
- `npm audit` temporarily reported zero findings;
- a direct compatibility test failed because minimatch 3 expects
  `require("brace-expansion")` to return a callable CommonJS function, while 5.0.8 exposes a
  different module API.

Keeping that override would make the audit appear green while breaking brace-based glob behavior.
The override and lockfile changes were fully removed. No forced transitive major override is
present in the branch.

## Risk statement

The remaining findings:

- are absent from the production dependency audit;
- execute in development/CI lint workflows;
- can cause memory exhaustion through pathological glob expansion;
- remain supply-chain findings and prevent a literal clean full audit.

The baseline remains blocked if governance requires `npm audit` to report zero findings. A
time-bounded acceptance may be considered only through explicit Release and Security approval,
with trusted-only lint inputs and an expiry tied to a compatible upstream release.

## Database validation

Local pgTAP could not be started because the Docker Desktop Linux engine and executable were not
available on the audit workstation. The GitHub Actions `database-security` job must validate the
exact integration SHA before approval.

## Next decision

Choose one:

1. keep the baseline blocked until Next.js/ESLint plugins publish ESLint 10-compatible releases;
2. approve a time-bounded development-tooling exception while requiring
   `npm audit --omit=dev` to remain clean.

No report may call the full audit clean while the nine findings remain.
