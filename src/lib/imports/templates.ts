export const IMPORT_TYPES = ["FUNDING_PROGRAMS", "FUNDING_CALLS", "COHORTS", "VENTURES", "VENTURE_ENROLLMENTS", "FOLLOW_UP_WAVES", "OBSERVATIONS", "MILESTONES"] as const;
export type ImportEntityType = typeof IMPORT_TYPES[number];
export type ImportField = { key: string; label: string; help: string; required: boolean };
type ImportTemplate = { label: string; description: string; fields: ImportField[]; requiredReferences: string[] };
const field = (key: string, label: string, help = "", required = false): ImportField => ({ key, label, help, required });
const identity = field("external_id", "Identificador na origem", "Identificador estável e único dentro da origem e do tipo. Não use o número da linha.", true);
const reference = (key: string, label: string) => [
  field(`${key}_external_id`, `${label}: identificador na origem`, "Use a mesma origem das importações anteriores. Preencha apenas uma das duas referências."),
  field(`${key}_id`, `${label}: ID no Atlas`, "Alternativa ao identificador na origem. Deve pertencer à instituição atual."),
];
const status = (help: string, required = false) => field("status", "Situação histórica", help, required);
const timestamp = (key: string, label: string, required = false) => field(key, label, "Data e hora ISO com fuso, por exemplo 2024-03-01T09:00:00-03:00. Não use a data do carregamento como substituta.", required);
const date = (key: string, label: string, required = false) => field(key, label, "Data no formato AAAA-MM-DD.", required);

export const IMPORT_TEMPLATES: Record<ImportEntityType, ImportTemplate> = {
  FUNDING_PROGRAMS: { label: "Programas", description: "Programas institucionais e seus identificadores estáveis.", requiredReferences: [], fields: [identity,
    field("name", "Nome", "De 2 a 160 caracteres.", true), field("slug", "Identificador de URL", "Letras minúsculas, números e hífens; de 2 a 64 caracteres.", true),
    field("code", "Código"), field("description", "Descrição"), status("DRAFT, ACTIVE, CLOSED ou ARCHIVED. Padrão: DRAFT."),
  ] },
  FUNDING_CALLS: { label: "Editais", description: "Editais históricos, sempre com divulgação pública e candidaturas desativadas.", requiredReferences: ["funding_program"], fields: [identity,
    ...reference("funding_program", "Programa"), field("title", "Título", "Até 200 caracteres.", true), field("call_number", "Número do edital", "Único na instituição.", true),
    field("short_title", "Título curto"), field("objective", "Objetivo"), status("DRAFT, OPEN, IN_REVIEW, CLOSED, RESULT_PUBLISHED ou ARCHIVED. Padrão: DRAFT."),
    timestamp("published_at", "Publicado em"), timestamp("application_starts_at", "Início das inscrições"), timestamp("application_ends_at", "Fim das inscrições"), timestamp("results_published_at", "Resultado publicado em"),
    field("total_budget", "Orçamento total", "Decimal não negativo com ponto e até duas casas, sem separador de milhar."), field("maximum_support", "Apoio máximo", "Decimal não negativo com ponto e até duas casas."),
    field("target_projects", "Quantidade prevista de projetos"), field("execution_months", "Meses de execução"), field("source_url", "URL oficial", "URL HTTPS da fonte oficial, se disponível."),
  ] },
  COHORTS: { label: "Coortes", description: "Ciclos de acompanhamento vinculados a um programa e, opcionalmente, a um edital e protocolo já existentes.", requiredReferences: ["funding_program"], fields: [identity,
    ...reference("funding_program", "Programa"), ...reference("funding_call", "Edital"), field("tracking_protocol_version_id", "ID da versão do protocolo", "Versão existente na instituição; obrigatória antes de importar ondas."),
    field("name", "Nome", "De 2 a 160 caracteres.", true), field("code", "Código"), field("reference_year", "Ano de referência"), date("starts_at", "Início"), date("ends_at", "Fim"), status("PLANNED, ACTIVE, CLOSED ou ARCHIVED. Padrão: PLANNED."),
  ] },
  VENTURES: { label: "Empreendimentos", description: "Identidade estável. Receitas, equipe e outros resultados pertencem às observações.", requiredReferences: [], fields: [identity,
    field("name", "Nome", "De 2 a 160 caracteres.", true), field("kind", "Tipo", "COMPANY, PROJECT, INITIATIVE ou OTHER.", true),
    field("slug", "Identificador de URL"), field("legal_name", "Razão social"), field("external_reference", "Referência institucional"), timestamp("archived_at", "Arquivado em"),
  ] },
  VENTURE_ENROLLMENTS: { label: "Participações", description: "Vínculos históricos entre a identidade do empreendimento e uma coorte.", requiredReferences: ["cohort", "venture"], fields: [identity,
    ...reference("cohort", "Coorte"), ...reference("venture", "Empreendimento"), timestamp("enrolled_at", "Ingresso em", true), timestamp("withdrawn_at", "Saída em"),
    status("ACTIVE ou WITHDRAWN. Se ausente, deriva da data de saída."), field("external_reference", "Referência institucional da participação"),
  ] },
  FOLLOW_UP_WAVES: { label: "Ondas de acompanhamento", description: "Momentos de acompanhamento com protocolo existente e referência histórica explícita.", requiredReferences: ["cohort"], fields: [identity,
    ...reference("cohort", "Coorte"), field("name", "Nome", "De 2 a 160 caracteres.", true), field("kind", "Tipo", "BASELINE ou FOLLOW_UP.", true),
    field("sequence", "Sequência", "0 para BASELINE; inteiro positivo para FOLLOW_UP.", true), field("offset_months", "Meses desde a referência"), date("scheduled_for", "Data de referência", true),
    timestamp("opens_at", "Aberta em"), timestamp("closes_at", "Encerrada em"), status("PLANNED, OPEN, CLOSED ou ARCHIVED. Padrão: PLANNED."),
  ] },
  OBSERVATIONS: { label: "Observações e valores", description: "Uma linha por indicador. Repita o mesmo identificador da observação em todas as suas linhas.", requiredReferences: ["venture_enrollment", "follow_up_wave"], fields: [identity,
    ...reference("venture_enrollment", "Participação"), ...reference("follow_up_wave", "Onda"), field("indicator_key", "Chave do indicador", "Chave exata da versão do protocolo da coorte.", true),
    field("value", "Valor", "Inteiro, decimal com ponto ou opção exata do indicador. Vazio é ausência; zero é um valor."), field("missing", "Ausência explícita", "true ou false. Quando true, deixe o valor vazio."),
    status("PENDING, IN_PROGRESS, SUBMITTED ou MISSED. Envio exige valor e data histórica comprovada.", true), timestamp("started_at", "Iniciada em"), timestamp("submitted_at", "Enviada em"),
  ] },
  MILESTONES: { label: "Marcos", description: "Acontecimentos históricos do empreendimento com data conhecida.", requiredReferences: ["venture"], fields: [identity,
    ...reference("venture", "Empreendimento"), field("type", "Tipo", "MVP_LAUNCHED, FIRST_CUSTOMER, COMPANY_FORMALIZED, RECURRING_CONTRACT, ADDITIONAL_INVESTMENT, TEAM_EXPANSION, PIVOT ou CLOSED.", true),
    field("title", "Título", "De 2 a 160 caracteres.", true), field("description", "Descrição"), timestamp("occurred_at", "Ocorrido em", true),
  ] },
};

export function importTemplateCsv(type: ImportEntityType) {
  return `${IMPORT_TEMPLATES[type].fields.map((item) => item.key).join(",")}\r\n`;
}
