# Repository Rules

- Keep this repository scoped to Doripe web code only: homepage, admin, app, blog, and required backend/Supabase code.
- Do not re-add legacy mobile prototypes, local planning documents, Figma scratch exports, or the old standalone `doripe-admin` app.
- Static files are organized by site under `public/home`, `public/admin`, `public/app`, and `public/blog`.
- `doripe.kr/admin` is served from `public/admin` and `src/admin-*`.
- Keep `vercel.json` free of rewrites to the deprecated `doripe-admin.vercel.app`.
- Never commit `.env`, `.env.*`, `.vercel`, `node_modules`, or local-only generated files.
