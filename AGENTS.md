# Working on Seeens

Read [README.md](README.md) for current scope and delivery targets. For schema, relationship logic, or outreach work, read [docs/context.md](docs/context.md). For UI work, read [docs/design-system/rules.md](docs/design-system/rules.md).

## Implementation constraints

- Build for Vercel hosting and shared data in Supabase. Keep the architecture simple; add server-side functionality when a workflow requires it.
- Use TypeScript and keep data access separate from rendering. Prefer small modules shaped around the MVP workflows.
- Enforce private workspace access in Supabase Row Level Security, including membership and related tables. Verify authorized and unauthorized read/write behavior when changing policies.
- Keep service-role keys, database credentials, real contact lists, and private notes out of source, fixtures, logs, and built assets. Use fictional sample data.
- Preserve outreach history when updating next actions. Keep Homie status independent of relationship stage.
- Keep database changes in versioned migrations when database implementation begins.

## Working process

- Keep scope aligned with the README. Historical material in `docs/archive/` is reference only and does not define current requirements.
- Use the repository's scripts (`npm run lint`, `npm run typecheck`, `npm run build`, and `npm run db:test` for database changes) and keep setup docs in the README current. There is no app test runner yet.
- Validate behavior affected by a change. For deployment changes, check production and preview environment configuration and Supabase auth redirect behavior. For UI changes, check mobile layout, keyboard operation, and loading/empty/error states.
- In handoffs, state what changed, what was checked, and what remains unverified.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
