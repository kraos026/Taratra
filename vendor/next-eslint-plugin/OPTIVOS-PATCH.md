# Scoped Next lint dependency remediation

Upstream: @next/eslint-plugin-next 16.3.8, MIT, Vercel/Next.js.
All distributed rule implementations and declarations are copied unchanged.
The sole implementation patch is dist/utils/get-root-dirs.js:

- replace fast-glob with pinned tinyglobby 0.2.17;
- disable directory expansion (fast-glob compatibility);
- preserve absolute pattern output and remove directory trailing separators;
- reject root patterns over 4096 characters or 128 nested braces before parsing.

This is a maintained local fork, not an official upstream security release.
The package manifest removes upstream development dependencies (not needed to
consume the distributed plugin). The original version identifies the rule
baseline, not an assertion that upstream itself is patched.

No rules or rule severity settings are removed. Vendor files are excluded from
project lint/format just like dependency distribution files in node_modules;
the application's existing lint scope is unchanged.

Regression: tests/security/lint-toolchain.test.mjs checks root discovery,
deeply nested input rejection and real Next/accessibility/TypeScript violations.
Upstream currently has no patched braces version for GHSA-vfj7-8cjw-p6xm.
Retire this fork only when an upstream plugin removes/fixes that dependency
and the same compatibility and negative-control tests pass.
