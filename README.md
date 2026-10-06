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
npm ci
npm run db:generate
npm run db:validate
npm run db:migrate
npm run typecheck
npm run test:security
npm run dev
```

As flags `ALLOW_DEV_RESET_TOKEN` e `ALLOW_DEV_INVITE_TOKEN` são exclusivas para desenvolvimento e devem permanecer desativadas em produção.

Os testes de domínio devem usar um PostgreSQL descartável. A integração contínua aplica as migrations e executa as verificações de tipos, segurança, domínio, demonstração e build, sem dispensar o banco de testes.

## Participação e seleção

A mesma conta pode atuar como participante e acessar os espaços institucionais para os quais possui autorização. Pessoas, equipes e projetos mantêm sua identidade ao participar de diferentes programas.

**Pessoa → Equipe → Projeto → Candidatura → Edital → Avaliação → Decisão → Acompanhamento**

Equipes e projetos são privados por padrão. Convites permitem ingressar em uma equipe; a candidatura entrega à instituição uma cópia das informações apresentadas na data do envio, preservada mesmo quando o projeto evolui.

A avaliação humana utiliza critérios e pesos definidos por edital. A classificação reúne apenas avaliações enviadas e informa a decisão institucional. O resultado é publicado de forma intencional; participantes consultam seu próprio resultado. Projetos selecionados podem ingressar em uma coorte com vínculo à candidatura de origem.

Os protocolos de acompanhamento preservam versões imutáveis de seus indicadores. Cada coorte utiliza uma versão definida, e as observações de cada onda mantêm o histórico, distinguindo valores observados de informações ausentes.

## Identidade e descoberta

O perfil de inovação reúne apresentação, competências, interesses, formação e experiência declarada. A pessoa escolhe a visibilidade de cada seção e pode publicar ou retirar seu perfil sem apagar os dados. Projetos também mantêm uma identidade pública opcional, administrada por seus responsáveis.

A trajetória preserva os períodos de participação em equipes e projetos, inclusive quando uma pessoa sai e depois retorna. Participações verificadas derivam de candidaturas enviadas, resultados publicados e vínculos vigentes na data da submissão; não substituem as informações históricas usadas na avaliação.

Editais e oportunidades externas entram na descoberta somente após publicação explícita. Participantes podem filtrar e salvar oportunidades, consultar suas fontes oficiais e entender a relação com os temas de seu perfil ou projeto. A compatibilidade utiliza regras transparentes e não constitui uma confirmação de elegibilidade.
