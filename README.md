# AutomateX

Socle SaaS B2B d'audit d'automatisation IA. Le Rule Engine et le moteur ROI sont déterministes ; l'IA est réservée à la rédaction à partir de résultats validés.

## Démarrage

1. Copier `.env.example` vers `.env.local` et renseigner les clés publiques Supabase.
2. Installer avec `npm install`.
3. Lancer `npm run dev`.

## État

- Interface responsive du tableau de bord.
- Architecture modulaire stricte.
- Clients Supabase SSR navigateur/serveur.
- Schéma multi-tenant initial avec RLS et soft delete.
- Contrats déterministes Rule Engine et ROI Engine.
- Tests unitaires des moteurs.

Les questions d'audit, règles, recommandations et hypothèses ROI métier doivent être fournies et validées avant leur intégration.
