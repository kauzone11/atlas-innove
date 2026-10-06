<p align="center">
  <img src="./public/brand/atlas-innove-lockup.svg" alt="Atlas Innove" width="280" />
</p>

<p align="center">
  <strong>Infraestrutura digital para acompanhar programas de fomento, empreendimentos e resultados ao longo do tempo.</strong>
</p>

<div align="center">
  <h3>Demonstração pública</h3>
  <p><strong><a href="https://innove.ouseagency.com/demo">innove.ouseagency.com/demo →</a></strong></p>
  <p><sub>Explore a visão institucional, o acompanhamento longitudinal e as oportunidades públicas sem necessidade de login.</sub></p>
</div>

---

## Sobre o Atlas Innove

O Atlas Innove é uma plataforma SaaS multi-institucional voltada ao acompanhamento de iniciativas apoiadas por programas de inovação e fomento.

A proposta é organizar, em uma mesma infraestrutura, o contexto do apoio recebido e a trajetória posterior de cada empreendimento. Em vez de encerrar a leitura no resultado de um edital, a plataforma preserva observações sucessivas ao longo do tempo e permite acompanhar como projetos e empreendimentos evoluem após o ingresso em uma política, programa ou chamada de incentivo.

O modelo conceitual parte desta sequência:

**Instituição → Programa de fomento → Edital → Coorte → Empreendimento → Ondas de acompanhamento → Evidências → Análise**

## Como o modelo funciona

- **Instituição** representa o órgão, fundação ou organização responsável pelo acompanhamento.
- **Programa de fomento** representa uma política, mecanismo ou iniciativa continuada de apoio à inovação.
- **Edital** representa uma chamada específica, com regras, recursos, cronograma e documentos próprios.
- **Coorte** reúne empreendimentos que ingressam no acompanhamento dentro de um mesmo ciclo comparável.
- **Empreendimento** preserva a identidade da iniciativa acompanhada ao longo do tempo.
- **Ondas de acompanhamento** representam momentos sucessivos de observação, como baseline, 6, 12 ou 24 meses.
- **Evidências** registram indicadores, marcos e informações observadas em cada momento, sem sobrescrever o histórico.
- **Análise** transforma esse histórico em uma leitura agregada da coorte e em trajetórias individuais dos empreendimentos.

## Acompanhamento longitudinal

O núcleo do Atlas Innove é a separação entre identidade e observação.

Um empreendimento continua sendo a mesma entidade ao longo do tempo, enquanto faturamento, equipe, clientes, estágio do produto, capital captado e outros indicadores podem mudar a cada onda. Essa estrutura permite comparar diferentes momentos sem substituir dados anteriores.

A plataforma também preserva a diferença entre ausência de resposta e valor zero. Uma observação não realizada permanece identificada como ausência de informação, evitando que lacunas sejam interpretadas como resultados.

O acompanhamento organiza e descreve evidências. Ele não transforma, por si só, uma associação observada em atribuição causal ao programa de fomento.

## Demonstração

A demonstração pública apresenta um recorte funcional do modelo longitudinal do Atlas Innove.

Ela utiliza metadados públicos de um programa de fomento como referência de contexto. Empreendimentos, pessoas, marcos e resultados exibidos no cenário demonstrativo são fictícios e existem exclusivamente para mostrar o funcionamento da plataforma.

**[Acessar a demonstração pública →](https://innove.ouseagency.com/demo)**

## Arquitetura

O Atlas Innove utiliza Next.js 15 com App Router, React 19, TypeScript em modo estrito, Prisma 6, PostgreSQL, Tailwind CSS, Zod, bcryptjs, date-fns e lucide-react.

A aplicação é multi-tenant. Dados pertencentes a uma instituição são isolados por organização, e operações autenticadas validam sessão, vínculo ativo e permissões no servidor antes de acessar ou modificar recursos institucionais.

As migrations em `prisma/migrations` formam o histórico versionado do schema do banco de dados.

## Desenvolvimento local

Use `.env.example` como referência para a configuração do ambiente e defina, no mínimo, `DATABASE_URL` e `SESSION_SECRET`.

```bash
npm install
npm run db:generate
npm run db:validate
npm run db:migrate
npm run typecheck
npm run test:security
npm run dev
```

As flags `ALLOW_DEV_RESET_TOKEN` e `ALLOW_DEV_INVITE_TOKEN` são exclusivas para desenvolvimento e devem permanecer desativadas em produção.

## Operational core

The authenticated workspace follows funding program → funding call → cohort → enrollment → follow-up wave → observation. Venture identity stays separate from enrollment and observed outcomes. A funding call can start as an unpublished draft; publication links and linked external documents are optional context.

Managers can register programs, calls, cohorts, ventures, enrollments, waves, observations and milestones. Administrators publish tracking protocols. Members can read organization data. Every API validates the signed session and active organization membership before using explicit organization-scoped filters.

Publish a protocol at `/app/protocols`, then apply its version when creating or editing a cohort. Published versions are immutable; the applied version freezes at the first wave. Later protocol publications leave existing cohorts unchanged. Legacy cohorts with waves but no applied protocol remain readable and cannot acquire a retroactive methodology through ordinary editing.

Each wave provisions observations for enrollments eligible at its reference date. Withdrawal preserves previous observations and does not erase an earlier eligible pending response. Draft saves replace the observation's complete value snapshot and require the current revision. Conflicting saves preserve the editor's unsaved values for comparison. Submitted observations are immutable. Closing and archiving waves preserve their history.

INTEGER, CURRENCY and ENUM values are validated against the exact applied version. Zero is observed data; blank values remain missing. Only submitted, valid values contribute to sums, means and category distributions. Counts and missing values accompany aggregates. Coverage is submitted observations divided by historically provisioned observations; a zero denominator is shown as unavailable. These descriptive results do not establish causal attribution.

The main routes are `/app`, `/app/programs`, `/app/programs/[programId]/calls/[callId]`, `/app/programs/[programId]/cohorts/[cohortId]`, `/app/follow-ups`, `/app/observations/[observationId]`, `/app/ventures/[ventureId]` and `/app/opportunities`. Opportunities are read-only organization records; an empty organization does not receive fictitious opportunities. Public `/demo` remains independent of authentication.

Use Node.js 22 and `npm ci`. Apply reviewed migrations with `npm run db:migrate:deploy`; never reset a shared database. Run `db:format`, `db:validate`, `db:generate`, `typecheck`, `test:security`, `test:domain`, `test:demo` and `build`. Domain integration tests require an explicit disposable PostgreSQL `DATABASE_URL`; without it they report a skip rather than database proof.
