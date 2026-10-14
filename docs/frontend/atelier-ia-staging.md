# Publication de l’Atelier IA en staging

MISSION: Publier la branche dédiée sur GitHub et créer une Preview Vercel du tableau de bord.
AFFECTED DOMAIN: Livraison SHADOW, configuration Preview et registre Supabase de staging.
CANONICAL OWNER: GitHub pour le code, Vercel pour la Preview, Supabase pour Auth/RLS et les migrations.
CURRENT STATUS: SHADOW — certification distante à établir sur le SHA déployé.
FILES EXPECTED: Documentation de livraison ; aucun moteur ou API canonique remplacé.
DB IMPACT: Migration additive agent_mission_links en staging uniquement, sans copie de données locales.
SECURITY IMPACT: Laboratoire activé seulement sur codex/optivos-hermes-ui en Preview ; authentification et RLS inchangés.
TEST PLAN: CI GitHub, build Vercel, identification du SHA, contrôles HTTP et isolation/RLS du registre distant.
OUT-OF-SCOPE: Production, fusion, reset, achat, lancement d’agent, export de secrets et ouverture publique de l’API Hermes.

TARGET: Supabase automatex-staging (ajvncwsazrhqjlktzojm), Vercel taratra / équipe optivos.
PRODUCTION?: NON. Optivos Production (mekihopfrfmqnhmtktgr) n’est pas une cible.
DISPOSABLE?: Base de staging existante, traitée comme persistante ; aucun reset autorisé.
BACKUP?: Pas d’écrasement ; opération additive isolée au nouveau registre.
MIGRATION REQUIRED?: 20261014153000_agent_mission_links.sql, déjà vérifiée en LOCAL.
RLS IMPACT?: Nouvelle politique SELECT par organisation/entreprise active ; aucune écriture client.
TENANT IMPACT?: Lignée composite et unicité de run conservées ; aucun dossier ou utilisateur créé pour cette livraison.
ROLLBACK PLAN?: Désactiver le flag Preview de la branche ou revenir à la Preview précédente, sans supprimer les données de staging.

## Configuration limitée à la branche

Le projet Vercel existant possède des variables Preview dirigées vers automatex-staging et des variables Production séparées. Les paramètres ajoutés pour cette livraison doivent avoir target=preview et gitBranch=codex/optivos-hermes-ui :

```text
NEXT_PUBLIC_OPTIVOS_ATELIER_IA_LAB=1
AUTOMATEX_CERTIFICATION_TARGET=staging
```

VERCEL_ENV est fourni par Vercel. Aucune clé Hermes, OpenRouter ou service-role n’est introduite dans le navigateur. Les comptes et droits de staging existants contrôlent l’accès à /atelier-ia et aux dossiers.

## Connexion Hermes depuis la Preview

Le tunnel localhost utilisé pour la recette LOCAL n’est pas joignable depuis Vercel. Il ne faut pas y transférer sa valeur d’URL. En l’absence d’une passerelle HTTPS privée validée, le guide annonce Connexion non configurée ; l’audit, les simulations et le registre de missions restent accessibles avec leurs droits existants. Aucune connexion réelle n’est annoncée comme active en staging sur la seule base des tests locaux.

La connexion distante sera une opération séparée, avec une origine HTTPS protégée et une clé serveur de consultation, avant tout raccordement. L’exécution et les appels IA restent désactivés.
