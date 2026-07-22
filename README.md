# AutomateX

Socle SaaS B2B d'audit d'automatisation IA. Le Rule Engine et le moteur ROI sont déterministes ; l'IA est réservée à la rédaction à partir de résultats validés.

## Démarrage

1. Copier `.env.example` vers `.env.local` et renseigner les clés publiques Supabase.
2. Renseigner `DATABASE_URL` avec la connexion PostgreSQL Supabase côté serveur.
3. Installer avec `npm install`.
4. Générer le client typé avec `npm run db:generate`.
5. Lancer `npm run dev`.

## État

- Interface responsive du tableau de bord.
- Architecture modulaire stricte.
- Clients Supabase SSR navigateur/serveur et onboarding sécurisé.
- Schéma multi-tenant initial avec RLS testée, soft delete et timestamps automatiques.
- Prisma côté serveur avec contexte RLS transactionnel.
- Fondations Tailwind CSS et shadcn/ui.
- Contrats déterministes Rule Engine et ROI Engine.
- Tests Vitest et tests PostgreSQL pgTAP des politiques RLS.

## Vérification

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
supabase start
npm run test:rls
```

Consultez `docs/data-access.md` avant d'ajouter un accès Prisma ou une migration.

Le fonctionnement du CRM, ses permissions et ses contrats HTTP sont décrits dans
[`docs/companies.md`](docs/companies.md).

Le versionnement des questionnaires et le cycle des audits sont documentés dans
[`docs/audit-questionnaires.md`](docs/audit-questionnaires.md).

Les questions d'audit, règles, recommandations et hypothèses ROI métier doivent être fournies et validées avant leur intégration.
