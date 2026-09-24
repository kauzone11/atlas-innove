# Atlas Innove

Atlas Innove is a multi-tenant SaaS platform for longitudinal monitoring of ventures supported by innovation and funding programs. Institutions can organize supported ventures into comparable cohorts and build structured evidence about how those ventures evolve over time.

The product connects institutional context, funding cycles and the history of each supported venture:

**Institution → Funding Program → Cohort → Venture → Follow-up Waves → Evidence → Analysis**

## Product model

- A funding program represents a policy, grant program, funding mechanism or institutional innovation-support initiative.
- A cohort represents a group of ventures entering longitudinal monitoring in the same cycle, edition or funding round.
- A venture represents the persistent startup, company, technological project or initiative being followed.
- Follow-up waves represent repeated observation periods so that evidence can be compared without overwriting the past.

Longitudinal observation matters because a venture's identity and its participation in a funding cycle are different from the evidence collected about its trajectory. Atlas Innove preserves those distinctions and supports structured monitoring over time. The platform organizes and describes evidence; it does not imply automatic causal attribution from that evidence.

## Demo

[Explore the public demonstration](https://innove.ouseagency.com/demo)

The platform is multi-institutional. Each organization has its own members, programs, cohorts and ventures, with server-side tenant boundaries on every organization-owned operation.

## Architecture

The application uses Next.js 15 App Router, React 19, TypeScript in strict mode, Prisma 6 with PostgreSQL, Tailwind CSS, Zod, bcryptjs, date-fns and lucide-react. Authentication is server-validated. Every organization-owned route receives an explicit organization identifier and checks the authenticated user's active membership and role before reading or mutating data.

The database migrations in `prisma/migrations` are the source-controlled schema history. Set `DATABASE_URL` and `SESSION_SECRET` using `.env` before running the application.

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
