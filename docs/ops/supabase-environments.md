# Supabase Environment Rules

## Production Project

For `doripe.kr`, the production Supabase project must be:

- project ref: `qfvirakzxtcgoerrqumh`

The Vercel `doripe` production environment variables must point to this project.

## App Experiment Project

The separate app experiment project has appeared in local scratch folders as:

- project ref: `dcyjrsxnpujslbxtitqj`

That project must not be used by `doripe.kr` production unless explicitly migrated.

## Required Rule

Schema changes must be committed as files under:

```text
supabase/migrations
```

Do not make dashboard-only schema changes and leave them undocumented.

## Local Secrets

Never commit:

- `SUPABASE_SERVICE_ROLE_KEY`
- real database URLs
- `.env`
- `.env.local`
- `.env.production`

Use Vercel environment variables and Supabase dashboard secrets.

## Verification

Run:

```bash
npm run check:supabase
npm run guard:repo
```
