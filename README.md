# Atlas Innove

Atlas Innove is a SaaS platform for longitudinal monitoring of ventures supported by innovation and funding programs. Institutions can organize programs and cohorts, collect structured follow-up data over time, record verifiable milestones and analyze how supported ventures evolve.

Longitudinal tracking is the core product concept:

**Institution → Program → Cohort → Venture → Follow-up waves → Evidence → Analysis**

## Current foundation

This initial repository establishes the institutional SaaS base:

- secure password registration and login;
- signed, HTTP-only, revocable sessions;
- organizations with active/inactive state;
- organization memberships with explicit roles;
- organization selection for users with multiple memberships;
- server-side authorization and tenant-bound access helpers;
- organization settings and team administration;
- invitation creation and authenticated acceptance;
- password recovery token lifecycle;
- Portuguese operational interface with accessible focus states and reduced-motion support.

The longitudinal domain is intentionally not implemented yet. Programs, cohorts, ventures, follow-up waves, milestones, questionnaires and analytical charts are planned for the next phase and are not represented as placeholder models or fake dashboard metrics.

## Architecture

The application uses Next.js 15 App Router, React 19, TypeScript in strict mode, Prisma 6 with PostgreSQL, Tailwind CSS, Zod, bcryptjs, date-fns and lucide-react. Authentication is server-validated. Every organization-owned route receives an explicit organization identifier and checks the authenticated user's active membership and role before reading or mutating data.

The database migration in `prisma/migrations` is the source-controlled schema history. Set `DATABASE_URL` and `SESSION_SECRET` using `.env` before running the application.

## Local development

```bash
npm install
npm run db:generate
npm run db:validate
npm run db:migrate
npm run typecheck
npm run test:security
npm run dev
```

Use `.env.example` as the starting point for local configuration. `ALLOW_DEV_RESET_TOKEN` and `ALLOW_DEV_INVITE_TOKEN` are development-only conveniences and must remain disabled in production.

## Scope boundaries

There is no billing, payment, catalog, pricing, wallet, commercial checkout, event-specific module or unrelated deployment infrastructure in this repository. The next product phase should extend the organization-scoped foundation without weakening its tenant-security invariants.
