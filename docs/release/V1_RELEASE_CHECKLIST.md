# Checklist release AutomateX v1.0.0

## Base et sécurité

- [x] Migrations rejouées depuis une base vide
- [x] Seeds et catalogues publiés vérifiés par pgTAP
- [x] Tests PostgreSQL et RLS verts
- [x] Audit des dépendances documenté
- [ ] Sauvegarde production créée et restauration testée
- [ ] Plan de rollback validé par l’exploitant
- [ ] Version PostgreSQL Supabase vérifiée compatible PostgreSQL 17

## Application

- [x] `npm ci`
- [x] génération Prisma
- [x] lint
- [x] format check
- [x] typecheck
- [x] Vitest
- [x] build de production
- [x] variables documentées sans secret réel

## Livraison

- [x] version package `1.0.0`
- [x] architecture, état, roadmap, guides et release notes
- [ ] PR de release approuvée et fusionnée
- [ ] tag Git annoté créé après validation humaine
- [ ] tag poussé
- [ ] GitHub Release créée depuis `RELEASE_NOTES_V1.0.0.md`

Commandes après approbation :

```bash
git tag -a v1.0.0 -m "AutomateX v1.0.0"
git push origin v1.0.0
```
