# Atlas Innove engineering instructions

## Product definition

Atlas Innove is a multi-tenant SaaS platform for longitudinal monitoring of ventures, startups, technological projects and other initiatives supported by innovation and public funding programs. The product follows this conceptual chain:

Institution → Program → Cohort → Venture → Follow-up waves → Evidence → Analysis.

The current repository is the institutional foundation only. Do not implement the longitudinal domain in the bootstrap cycle.

## Architecture boundaries

- Use Next.js 15 App Router, React 19, strict TypeScript, Prisma 6, PostgreSQL, Tailwind CSS, Zod, bcryptjs, date-fns and lucide-react.
- Keep server authentication and authorization in `src/lib/auth`.
- Keep Prisma access behind the shared database client in `src/lib/db.ts`.
- Every organization-owned query or mutation must carry an explicit `organizationId` boundary and validate membership on the server.
- Keep platform-level `SUPER_ADMIN` concerns separate from organization context.
- Do not add billing, payments, checkout, catalog, pricing, wallet, observatory, event-specific, legacy-methodology or unrelated infrastructure modules.

## Language rules

- Source identifiers, filenames, types, fields, error codes, comments, commit messages and technical documentation use English.
- Product copy uses Brazilian Portuguese.
- Comments are reserved for security requirements, non-obvious invariants, concurrency rules or architectural decisions.
- Do not add generated-by-AI language, personal signatures or speculative abstractions.

## Direct-to-main workflow

- Work directly on `main` when the repository has that branch. Do not create branches or pull requests unless explicitly requested.
- Inspect `git status`, existing implementation and relevant configuration before editing.
- Preserve unrelated dirty files and do not use `git add .`, reset, clean, stash, force-push or destructive overwrite operations.
- Keep each cycle cohesive and reasonably atomic. Do not combine unrelated cleanup with requested work.
- Commit with the exact requested message when a task authorizes a commit. Push only when a usable remote is configured and the push is explicitly in scope.

## Tenant-security invariants

- A session is valid only when its signature, stored token hash, expiry, revocation state and user session version all match.
- An authenticated user must have an active membership in an active organization before organization access is granted.
- A client-provided organization ID is never trusted without a server-side membership lookup.
- Disabled memberships and inactive organizations fail closed.
- Role changes cannot escalate an administrator to owner or bypass the role hierarchy.
- Organization-owned records must use explicit tenant-scoped filters.

## UI and UX rules

- Keep the product institutional, analytical, calm and precise.
- Prefer semantic HTML, clear hierarchy, restrained surfaces, accessible focus states, responsive layouts and meaningful empty/error/success states.
- Use Lucide icons when an icon improves comprehension.
- Do not add fake metrics, excessive cards, decorative gradients, neon, glassmorphism or marketing UI inside operational screens.
- Respect reduced-motion preferences.

## Database migration rules

- Change `prisma/schema.prisma` and create a named migration for schema changes.
- Validate and format Prisma schema before committing.
- Never use an implicit destructive reset against a shared database.
- Keep migrations additive and review generated SQL before applying them.

## Validation strategy

Keep validation focused. For foundation changes, run dependency installation integrity, Prisma format/validation/generation, strict TypeScript typecheck, focused authentication/tenant tests and one production build. Do not run broad browser or full end-to-end suites unless a failure requires them.

## Change discipline

Inspect current behavior before changing it. Preserve behavior unless the task explicitly changes it. Do not begin the next longitudinal product phase during foundation work.
