# Prisma Transitive Security Risk Acceptance

## Scope

Certified candidate SHA: `f80a67ca6125e0b96c42e4b52fe049bb47f3b177`.

The remaining advisories are `prisma`, `@prisma/config`, `deepmerge-ts`, and `mysql2`.
They remain present in the installed dependency graph; this document does not claim
that the packages are vulnerability-free.

## Production audit

`npm audit --omit=dev --json` reports 0 critical, 4 high, 0 moderate, 0 low,
4 total. The packages remain present because root `prisma` (7.9.1) satisfies the
optional `prisma: "*"` peer of production `@prisma/client` (7.9.1).

## Dependency reachability

| Package          | Path                              | Installed | Next runtime trace | Application runtime |
| ---------------- | --------------------------------- | --------- | ------------------ | ------------------- |
| `prisma`         | optional peer of `@prisma/client` | Yes       | No                 | No                  |
| `@prisma/config` | `prisma` dependency               | Yes       | No                 | No                  |
| `deepmerge-ts`   | `@prisma/config` dependency       | Yes       | No                 | No                  |
| `mysql2`         | Prisma tooling dependency         | Yes       | No                 | No                  |

The temporary production install reproduced this tree. Removing only the root
Prisma devDependency removed the Prisma tooling subtree while retaining
`@prisma/client`, confirming optional-peer promotion.

## Build-time reachability

`postinstall` and `build` invoke `prisma generate`; local certification also invokes
`prisma validate`. These commands load Prisma CLI/configuration code. The generated
client used by the application imports Prisma runtime code and the PostgreSQL
adapter, not the Prisma CLI, `@prisma/config`, `deepmerge-ts`, or `mysql2`.

## deepmerge-ts

Version 7.1.5 remains vulnerable; the fixed release requires an incompatible major
change to the Prisma configuration stack. The package is reached through
`prisma -> @prisma/config -> deepmerge-ts` during trusted Prisma configuration
processing. Inputs are repository files, schema, filesystem state, and environment
configuration. No HTTP request body, tenant/company data, database row, or normal
SaaS user input is passed to this build-time path. An attacker-controlled recursive
object graph was not observed in the application execution path.

Classification: trusted build configuration only.

## mysql2

`mysql2` is installed through Prisma tooling. The application datasource is
PostgreSQL-only, and no application import or MySQL/MariaDB datasource was found.
The package is not present in any Next deployable NFT runtime trace. Prisma tooling
may load its Studio/MySQL support module during CLI startup, but no MySQL connection
is attempted by the PostgreSQL application path.

## Prisma CLI

Prisma CLI is a development/build tool promoted into npm's production tree by the
optional peer relationship. It is invoked at install/build/certification time, not
by runtime request handling. A forced Prisma 6 downgrade and Prisma 8 RC adoption
were rejected. Prisma 7.10 is a separate compatibility project; its metadata still
references `deepmerge-ts` 7.1.5 and `mysql2` 3.15.3.

## Compensating controls

- package-lock changes are committed and reviewed;
- no `npm audit fix --force` or unsafe overrides are used;
- PostgreSQL-only runtime architecture;
- no runtime `mysql2` import;
- Prisma commands run in controlled local/CI environments;
- dependency audit is reviewed before production releases.

## Temporary acceptance

Decision: `TEMPORARILY_ACCEPTED_WITH_CONTROLS`.

Review deadline: **2026-10-15**.

Review earlier if a stable Prisma release fixes the affected transitive packages,
Prisma 8 reaches GA, the database architecture gains MySQL/MariaDB, Prisma config
becomes dynamically user-controlled, reachability/severity changes materially, or
`npm audit --omit=dev` no longer reflects the current assumption.

## Prohibited remediation

- no forced Prisma 6 downgrade;
- no Prisma 8 RC adoption solely to silence audit;
- no semver-unsafe `deepmerge-ts` or `mysql2` override;
- no disabling npm audit.
