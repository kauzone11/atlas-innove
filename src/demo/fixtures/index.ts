export const DEMO_ORGANIZATION_SLUG = "atlas-innove-demo";
export const DEMO_PROGRAM_SLUG = "centelha-2-se-demo";
export const DEMO_COHORT_CODE = "centelha-2-se-cenario-demo";
export const DEMO_PROTOCOL_SLUG = "acompanhamento-empreendimentos-inovadores";

export type DemoIndicatorInput = {
  team_size: number;
  paying_customers: number;
  monthly_revenue: string;
  additional_capital: string;
  product_stage: "CONCEPT" | "PROTOTYPE" | "MVP" | "VALIDATION" | "MARKET" | "SCALE";
};

export type DemoObservationFixture = {
  sequence: number;
  status: "SUBMITTED" | "MISSED";
  values?: DemoIndicatorInput;
};

export type DemoVentureFixture = {
  slug: string;
  name: string;
  kind: "COMPANY" | "PROJECT" | "INITIATIVE" | "OTHER";
  status: "ACTIVE" | "WITHDRAWN";
  enrolledAt: string;
  withdrawnAt?: string;
  observations: DemoObservationFixture[];
  milestones: Array<{
    type: "MVP_LAUNCHED" | "FIRST_CUSTOMER" | "COMPANY_FORMALIZED" | "RECURRING_CONTRACT" | "ADDITIONAL_INVESTMENT" | "TEAM_EXPANSION" | "PIVOT" | "CLOSED";
    title: string;
    occurredAt: string;
    description?: string;
  }>;
};

export const demoVentureFixtures: DemoVentureFixture[] = [
  {
    slug: "orlasense",
    name: "OrlaSense",
    kind: "COMPANY",
    status: "ACTIVE",
    enrolledAt: "2023-02-14",
    observations: [
      { sequence: 0, status: "SUBMITTED", values: { team_size: 3, paying_customers: 0, monthly_revenue: "0.00", additional_capital: "0.00", product_stage: "PROTOTYPE" } },
      { sequence: 1, status: "SUBMITTED", values: { team_size: 4, paying_customers: 2, monthly_revenue: "5000.00", additional_capital: "0.00", product_stage: "MVP" } },
      { sequence: 2, status: "SUBMITTED", values: { team_size: 6, paying_customers: 9, monthly_revenue: "22000.00", additional_capital: "120000.00", product_stage: "MARKET" } },
      { sequence: 3, status: "SUBMITTED", values: { team_size: 8, paying_customers: 26, monthly_revenue: "60000.00", additional_capital: "250000.00", product_stage: "SCALE" } },
    ],
    milestones: [
      { type: "MVP_LAUNCHED", title: "MVP lançado", occurredAt: "2023-07-20", description: "Primeira versão operacional do monitoramento costeiro." },
      { type: "FIRST_CUSTOMER", title: "Primeiro cliente", occurredAt: "2023-10-04" },
      { type: "ADDITIONAL_INVESTMENT", title: "Capital adicional captado", occurredAt: "2024-05-15" },
      { type: "TEAM_EXPANSION", title: "Expansão da equipe", occurredAt: "2025-02-11" },
    ],
  },
  {
    slug: "cajuflux",
    name: "CajuFlux",
    kind: "COMPANY",
    status: "ACTIVE",
    enrolledAt: "2023-02-14",
    observations: [
      { sequence: 0, status: "SUBMITTED", values: { team_size: 2, paying_customers: 0, monthly_revenue: "0.00", additional_capital: "0.00", product_stage: "CONCEPT" } },
      { sequence: 1, status: "SUBMITTED", values: { team_size: 3, paying_customers: 1, monthly_revenue: "2500.00", additional_capital: "0.00", product_stage: "PROTOTYPE" } },
      { sequence: 2, status: "SUBMITTED", values: { team_size: 4, paying_customers: 4, monthly_revenue: "9800.00", additional_capital: "60000.00", product_stage: "VALIDATION" } },
      { sequence: 3, status: "SUBMITTED", values: { team_size: 5, paying_customers: 12, monthly_revenue: "21000.00", additional_capital: "60000.00", product_stage: "MARKET" } },
    ],
    milestones: [
      { type: "MVP_LAUNCHED", title: "MVP lançado", occurredAt: "2023-08-16" },
      { type: "FIRST_CUSTOMER", title: "Primeiro cliente", occurredAt: "2023-11-09" },
      { type: "COMPANY_FORMALIZED", title: "Empresa formalizada", occurredAt: "2024-01-22" },
    ],
  },
  {
    slug: "nexo-mangue",
    name: "Nexo Mangue",
    kind: "PROJECT",
    status: "ACTIVE",
    enrolledAt: "2023-02-14",
    observations: [
      { sequence: 0, status: "SUBMITTED", values: { team_size: 3, paying_customers: 0, monthly_revenue: "0.00", additional_capital: "80000.00", product_stage: "PROTOTYPE" } },
      { sequence: 1, status: "SUBMITTED", values: { team_size: 4, paying_customers: 0, monthly_revenue: "0.00", additional_capital: "80000.00", product_stage: "MVP" } },
      { sequence: 2, status: "SUBMITTED", values: { team_size: 5, paying_customers: 1, monthly_revenue: "1800.00", additional_capital: "140000.00", product_stage: "VALIDATION" } },
      { sequence: 3, status: "SUBMITTED", values: { team_size: 5, paying_customers: 5, monthly_revenue: "8500.00", additional_capital: "140000.00", product_stage: "MARKET" } },
    ],
    milestones: [
      { type: "MVP_LAUNCHED", title: "MVP lançado", occurredAt: "2023-09-05" },
      { type: "ADDITIONAL_INVESTMENT", title: "Capital adicional captado", occurredAt: "2024-03-12" },
      { type: "FIRST_CUSTOMER", title: "Primeiro cliente", occurredAt: "2024-09-03" },
    ],
  },
  {
    slug: "vertice-mare",
    name: "Vértice Maré",
    kind: "COMPANY",
    status: "ACTIVE",
    enrolledAt: "2023-02-14",
    observations: [
      { sequence: 0, status: "SUBMITTED", values: { team_size: 2, paying_customers: 0, monthly_revenue: "0.00", additional_capital: "200000.00", product_stage: "PROTOTYPE" } },
      { sequence: 1, status: "SUBMITTED", values: { team_size: 3, paying_customers: 0, monthly_revenue: "0.00", additional_capital: "350000.00", product_stage: "MVP" } },
      { sequence: 2, status: "SUBMITTED", values: { team_size: 4, paying_customers: 0, monthly_revenue: "0.00", additional_capital: "350000.00", product_stage: "VALIDATION" } },
      { sequence: 3, status: "SUBMITTED", values: { team_size: 6, paying_customers: 3, monthly_revenue: "7000.00", additional_capital: "500000.00", product_stage: "MARKET" } },
    ],
    milestones: [
      { type: "MVP_LAUNCHED", title: "MVP lançado", occurredAt: "2023-10-18" },
      { type: "ADDITIONAL_INVESTMENT", title: "Capital adicional captado", occurredAt: "2024-02-26" },
      { type: "FIRST_CUSTOMER", title: "Primeiro cliente", occurredAt: "2025-01-16" },
    ],
  },
  {
    slug: "sabia-automa",
    name: "Sabiá Automa",
    kind: "COMPANY",
    status: "ACTIVE",
    enrolledAt: "2023-02-14",
    observations: [
      { sequence: 0, status: "SUBMITTED", values: { team_size: 4, paying_customers: 1, monthly_revenue: "1200.00", additional_capital: "0.00", product_stage: "MVP" } },
      { sequence: 1, status: "SUBMITTED", values: { team_size: 5, paying_customers: 4, monthly_revenue: "9000.00", additional_capital: "0.00", product_stage: "VALIDATION" } },
      { sequence: 2, status: "SUBMITTED", values: { team_size: 7, paying_customers: 12, monthly_revenue: "24000.00", additional_capital: "0.00", product_stage: "MARKET" } },
      { sequence: 3, status: "SUBMITTED", values: { team_size: 9, paying_customers: 21, monthly_revenue: "51000.00", additional_capital: "100000.00", product_stage: "SCALE" } },
    ],
    milestones: [
      { type: "FIRST_CUSTOMER", title: "Primeiro cliente", occurredAt: "2023-01-30" },
      { type: "RECURRING_CONTRACT", title: "Primeiro contrato recorrente", occurredAt: "2023-12-06" },
      { type: "TEAM_EXPANSION", title: "Expansão da equipe", occurredAt: "2024-08-19" },
    ],
  },
  {
    slug: "serigy-health",
    name: "Serigy Health",
    kind: "COMPANY",
    status: "ACTIVE",
    enrolledAt: "2023-02-14",
    observations: [
      { sequence: 0, status: "SUBMITTED", values: { team_size: 3, paying_customers: 0, monthly_revenue: "0.00", additional_capital: "0.00", product_stage: "PROTOTYPE" } },
      { sequence: 1, status: "SUBMITTED", values: { team_size: 3, paying_customers: 1, monthly_revenue: "1500.00", additional_capital: "0.00", product_stage: "MVP" } },
      { sequence: 2, status: "SUBMITTED", values: { team_size: 4, paying_customers: 2, monthly_revenue: "4200.00", additional_capital: "0.00", product_stage: "VALIDATION" } },
      { sequence: 3, status: "SUBMITTED", values: { team_size: 4, paying_customers: 3, monthly_revenue: "6000.00", additional_capital: "0.00", product_stage: "VALIDATION" } },
    ],
    milestones: [
      { type: "MVP_LAUNCHED", title: "MVP lançado", occurredAt: "2023-08-30" },
      { type: "FIRST_CUSTOMER", title: "Primeiro cliente", occurredAt: "2023-12-01" },
    ],
  },
  {
    slug: "terrametrica",
    name: "TerraMétrica",
    kind: "PROJECT",
    status: "ACTIVE",
    enrolledAt: "2023-02-14",
    observations: [
      { sequence: 0, status: "SUBMITTED", values: { team_size: 2, paying_customers: 0, monthly_revenue: "0.00", additional_capital: "0.00", product_stage: "CONCEPT" } },
      { sequence: 1, status: "SUBMITTED", values: { team_size: 3, paying_customers: 0, monthly_revenue: "0.00", additional_capital: "0.00", product_stage: "PROTOTYPE" } },
      { sequence: 2, status: "SUBMITTED", values: { team_size: 3, paying_customers: 2, monthly_revenue: "3500.00", additional_capital: "80000.00", product_stage: "MVP" } },
      { sequence: 3, status: "SUBMITTED", values: { team_size: 4, paying_customers: 4, monthly_revenue: "10000.00", additional_capital: "80000.00", product_stage: "VALIDATION" } },
    ],
    milestones: [
      { type: "PIVOT", title: "Pivot de produto", occurredAt: "2024-03-04", description: "A solução passou a priorizar dados de uso do solo." },
      { type: "MVP_LAUNCHED", title: "MVP lançado", occurredAt: "2024-06-10" },
    ],
  },
  {
    slug: "mangaba-nativa",
    name: "Mangaba Nativa",
    kind: "COMPANY",
    status: "ACTIVE",
    enrolledAt: "2023-02-14",
    observations: [
      { sequence: 0, status: "SUBMITTED", values: { team_size: 2, paying_customers: 0, monthly_revenue: "0.00", additional_capital: "0.00", product_stage: "CONCEPT" } },
      { sequence: 1, status: "SUBMITTED", values: { team_size: 3, paying_customers: 1, monthly_revenue: "800.00", additional_capital: "0.00", product_stage: "PROTOTYPE" } },
      { sequence: 2, status: "MISSED" },
      { sequence: 3, status: "SUBMITTED", values: { team_size: 4, paying_customers: 6, monthly_revenue: "16000.00", additional_capital: "60000.00", product_stage: "MARKET" } },
    ],
    milestones: [
      { type: "MVP_LAUNCHED", title: "MVP lançado", occurredAt: "2023-11-14" },
      { type: "FIRST_CUSTOMER", title: "Primeiro cliente", occurredAt: "2024-01-18" },
      { type: "ADDITIONAL_INVESTMENT", title: "Capital adicional captado", occurredAt: "2025-05-22" },
    ],
  },
  {
    slug: "aratu-reuso",
    name: "Aratu Reuso",
    kind: "INITIATIVE",
    status: "ACTIVE",
    enrolledAt: "2023-02-14",
    observations: [
      { sequence: 0, status: "SUBMITTED", values: { team_size: 3, paying_customers: 0, monthly_revenue: "0.00", additional_capital: "0.00", product_stage: "PROTOTYPE" } },
      { sequence: 1, status: "SUBMITTED", values: { team_size: 3, paying_customers: 2, monthly_revenue: "2800.00", additional_capital: "0.00", product_stage: "MVP" } },
      { sequence: 2, status: "SUBMITTED", values: { team_size: 4, paying_customers: 5, monthly_revenue: "11000.00", additional_capital: "0.00", product_stage: "MARKET" } },
      { sequence: 3, status: "MISSED" },
    ],
    milestones: [
      { type: "MVP_LAUNCHED", title: "MVP lançado", occurredAt: "2023-09-21" },
      { type: "FIRST_CUSTOMER", title: "Primeiro cliente", occurredAt: "2023-12-14" },
    ],
  },
  {
    slug: "farol-de-dados",
    name: "Farol de Dados",
    kind: "COMPANY",
    status: "WITHDRAWN",
    enrolledAt: "2023-02-14",
    withdrawnAt: "2024-11-18",
    observations: [
      { sequence: 0, status: "SUBMITTED", values: { team_size: 2, paying_customers: 0, monthly_revenue: "0.00", additional_capital: "0.00", product_stage: "CONCEPT" } },
      { sequence: 1, status: "SUBMITTED", values: { team_size: 2, paying_customers: 1, monthly_revenue: "900.00", additional_capital: "0.00", product_stage: "PROTOTYPE" } },
      { sequence: 2, status: "SUBMITTED", values: { team_size: 3, paying_customers: 2, monthly_revenue: "3000.00", additional_capital: "0.00", product_stage: "MVP" } },
    ],
    milestones: [
      { type: "MVP_LAUNCHED", title: "MVP lançado", occurredAt: "2023-10-02" },
      { type: "CLOSED", title: "Participação encerrada", occurredAt: "2024-11-18", description: "A participação foi retirada antes da onda de 24 meses." },
    ],
  },
];

export const demoWaves = [
  { sequence: 0, name: "Baseline", kind: "BASELINE" as const, offsetMonths: 0, scheduledFor: "2023-02-14", status: "CLOSED" as const },
  { sequence: 1, name: "6 meses", kind: "FOLLOW_UP" as const, offsetMonths: 6, scheduledFor: "2023-08-14", status: "CLOSED" as const },
  { sequence: 2, name: "12 meses", kind: "FOLLOW_UP" as const, offsetMonths: 12, scheduledFor: "2024-02-14", status: "CLOSED" as const },
  { sequence: 3, name: "24 meses", kind: "FOLLOW_UP" as const, offsetMonths: 24, scheduledFor: "2025-02-14", status: "CLOSED" as const },
];

export const demoOpportunities = [
  {
    callNumber: "09/2026",
    institution: "FAPITEC/SE · FUNTEC",
    title: "Programa de Residência em Inovação",
    objective: "Apoiar atividades de pesquisa, desenvolvimento e inovação em empresas sergipanas.",
    territory: "Sergipe",
    audience: "Micro, pequenas e médias empresas sediadas em Sergipe",
    status: "OPEN" as const,
    publishedAt: "2026-07-17",
    applicationEndsAt: null,
    sourceUrl: "https://fapitec.se.gov.br/editais-abertos/edital-fapitec-se-funtec-no-09-2026-programa-de-residencia-em-inovacao/",
  },
  {
    callNumber: "10/2026",
    institution: "FAPITEC/SE · FUNTEC",
    title: "Tecnologias Sociais",
    objective: "Apoiar projetos voltados ao desenvolvimento territorial sustentável, geração de renda e inclusão produtiva.",
    territory: "Comunidades sergipanas",
    audience: "Projetos com participação comunitária e impacto social mensurável",
    status: "IN_REVIEW" as const,
    publishedAt: "2026-08-20",
    applicationEndsAt: null,
    sourceUrl: "https://fapitec.se.gov.br/editais-abertos/edital-fapitec-se-funtec-no-10-2026-tecnologias-sociais/",
  },
  {
    callNumber: "11/2026",
    institution: "FAPITEC/SE · FUNTEC",
    title: "Programa de Apoio às Empresas Juniores",
    objective: "Selecionar projetos inovadores apresentados por empresas juniores federadas sediadas em Sergipe.",
    territory: "Sergipe",
    audience: "Empresas Juniores Federadas com parceria formal",
    status: "IN_REVIEW" as const,
    publishedAt: "2026-08-21",
    applicationEndsAt: null,
    sourceUrl: "https://fapitec.se.gov.br/editais-em-andamento/edital-fapitec-se-funtec-no-11-2026-programa-de-apoio-as-empresas-juniores/",
  },
];

export const demoIndicatorDefinitions = [
  { key: "team_size", label: "Tamanho da equipe", valueType: "INTEGER" as const, unit: "pessoas", position: 0 },
  { key: "paying_customers", label: "Clientes pagantes", valueType: "INTEGER" as const, unit: "clientes", position: 1 },
  { key: "monthly_revenue", label: "Faturamento mensal", valueType: "CURRENCY" as const, unit: "BRL", position: 2 },
  { key: "additional_capital", label: "Capital adicional acumulado", valueType: "CURRENCY" as const, unit: "BRL", position: 3 },
  { key: "product_stage", label: "Estágio do produto", valueType: "ENUM" as const, unit: null, position: 4, allowedValues: ["CONCEPT", "PROTOTYPE", "MVP", "VALIDATION", "MARKET", "SCALE"] },
];
