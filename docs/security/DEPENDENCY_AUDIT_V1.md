# Audit des dépendances — AutomateX V1

Date : 2026-07-26. Commandes : `npm audit`, `npm audit --omit=dev`, `npm outdated`.

Avant : 17 entrées (16 high, 1 moderate), dont 6 avec `--omit=dev`.
Après : 13 entrées (9 high dev-only, 4 moderate CLI), aucune critique. `--omit=dev` retourne
uniquement les quatre alertes modérées du CLI Prisma.

| Entrée initiale          | Version/chemin initial | Type       | Env.       | Sévérité | Version corrigée          | Statut et exploitabilité                                 |
| ------------------------ | ---------------------- | ---------- | ---------- | -------- | ------------------------- | -------------------------------------------------------- |
| `@eslint/config-array`   | 0.21.2 → minimatch     | transitive | dev        | high     | ESLint 10                 | accepted temporarily : aucun chemin runtime              |
| `@eslint/eslintrc`       | 3.3.6 → minimatch      | transitive | dev        | high     | ESLint 10                 | accepted temporarily : plugins Next incompatibles        |
| `@prisma/dev`            | 0.24.14                | transitive | CLI        | high     | Prisma 7.8                | mitigated : 0.24.3, plus de `find-my-way` 9.6            |
| `@tailwindcss/postcss`   | 4.3.3 → PostCSS 8.5.10 | direct     | build      | high     | PostCSS >8.5.17           | fixed : 8.5.23                                           |
| `brace-expansion`        | 1.1.16/5.0.7           | transitive | dev        | high     | 5.0.8                     | accepted temporarily : API incompatible avec minimatch 3 |
| `eslint`                 | 9.39.5 → minimatch     | direct     | dev        | high     | 10.8.0                    | accepted temporarily : hors peer range des plugins Next  |
| `eslint-config-next`     | 16.2.11                | direct     | dev        | high     | transitives               | accepted temporarily après passage à 16.2.12             |
| `eslint-plugin-import`   | 2.32.0 → minimatch     | transitive | dev        | high     | aucune isolée             | accepted temporarily : CI uniquement                     |
| `eslint-plugin-jsx-a11y` | 6.10.2 → minimatch     | transitive | dev        | high     | aucune isolée             | accepted temporarily : CI uniquement                     |
| `eslint-plugin-react`    | 7.37.5 → minimatch     | transitive | dev        | high     | chaîne future             | accepted temporarily : CI uniquement                     |
| `find-my-way`            | 9.6.0 via Prisma       | transitive | CLI        | high     | >9.6.0                    | fixed : absent de Prisma 7.8                             |
| `minimatch`              | 3.1.5/10.2.5           | transitive | dev        | high     | chaîne ESLint 10          | accepted temporarily : globs du dépôt seulement          |
| `next`                   | 16.2.11 → PostCSS      | direct     | production | high     | PostCSS >8.5.17           | fixed : Next 16.2.12 + PostCSS 8.5.23                    |
| `postcss`                | 8.5.10                 | transitive | build      | high     | 8.5.18+                   | fixed : 8.5.23                                           |
| `prisma`                 | 7.9.0 → `@prisma/dev`  | direct     | CLI        | high     | 7.8.0 selon audit initial | mitigated : 7.8.0, alertes modérées restantes            |
| `valibot`                | 1.2.0 via Prisma       | transitive | CLI        | moderate | 1.4.2                     | accepted temporarily : entrée non utilisateur            |
| `vite`                   | 8.1.5 → PostCSS        | transitive | test       | high     | PostCSS >8.5.17           | fixed : 8.5.23                                           |

## Acceptations temporaires et mesures compensatoires

Les neuf alertes high restantes appartiennent à ESLint/minimatch/brace-expansion. Elles ne sont
pas installées comme runtime de production et ne traitent que des motifs versionnés du dépôt.
Forcer `brace-expansion` 5.0.8 casse ESLint 9 ; ESLint 10 n’est pas supporté par les plugins Next.
Mesures : CI isolée, globs sans entrée utilisateur, lockfile revu.

Les quatre modérées restantes (`prisma`, `@prisma/dev`, `@hono/node-server`, `valibot`) sont dans
le CLI Prisma. AutomateX n’expose ni `serveStatic` de Hono ni `flatten()` de Valibot. Mesures :
schéma Prisma versionné, CI isolée, aucune entrée utilisateur dans `prisma generate`.

Impact accepté : déni de service limité au processus de build avec configuration hostile.
Réexamen : 2026-08-31 ou dès qu’une chaîne Next/ESLint/Prisma compatible est disponible.

## Mises à jour contrôlées

- Prisma `7.9.0` → `7.8.0` ;
- Next / eslint-config-next `16.2.11` → `16.2.12` ;
- Supabase JS `2.110.7` → `2.110.8` ;
- pg `8.16.3` → `8.22.0` ;
- Recharts `3.10.0` → `3.10.1`, désormais épinglé ;
- tailwind-merge `3.4.0` → `3.6.0` ;
- PostCSS override `8.5.10` → `8.5.23`.

Aucun `npm audit fix --force` n’a été exécuté. L’override incompatible `brace-expansion` a été
retiré dès l’échec du lint.
