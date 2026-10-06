import type { Prisma } from "@prisma/client";
import type { AnalyticsAccess, AnalyticsFilters } from "@/lib/analytics/types";
import type { AnalyticsReportPayload, GenerateAnalyticsReportInput } from "@/lib/analytics/report-schemas";

export type ReportGeneratorContext = {
  access: AnalyticsAccess;
  client: Prisma.TransactionClient;
  input: GenerateAnalyticsReportInput;
  filters: AnalyticsFilters;
  base: Pick<AnalyticsReportPayload, "analyticsSchemaVersion" | "title" | "dataAsOf" | "scope" | "methodology">;
};

export const reportMethodology = {
  interpretation: "Os resultados descrevem evidências registradas e não implicam atribuição causal ao programa ou à instituição.",
  eligibility: "Somente observações submetidas contribuem para resultados observados. Ausência de valor é distinta de zero; a cobertura informa o denominador elegível.",
  comparability: "Comparações entre coortes exigem a mesma métrica canônica e o mesmo mês de referência longitudinal. Ondas sem mês de referência ou com meses duplicados não são automaticamente comparáveis.",
};
