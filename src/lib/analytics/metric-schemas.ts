import { z } from "zod";

export const metricDefinitionSchema = z.object({
  key: z.string().trim().min(1).max(160).regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  valueType: z.enum(["INTEGER", "CURRENCY", "ENUM"]),
  unit: z.string().trim().max(40).optional().nullable(),
  allowedValues: z.array(z.string().trim().min(1).max(120)).max(30).optional().nullable(),
  primaryAggregation: z.enum(["TOTAL", "MEAN", "MEDIAN", "DISTRIBUTION"]),
}).superRefine((input, context) => {
  if (input.valueType === "ENUM" && (!input.allowedValues?.length || input.primaryAggregation !== "DISTRIBUTION")) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["allowedValues"], message: "Uma métrica de categorias exige opções e distribuição." });
  }
  if (input.valueType !== "ENUM" && (input.allowedValues?.length || input.primaryAggregation === "DISTRIBUTION")) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["primaryAggregation"], message: "Escolha total, média ou mediana para valores numéricos." });
  }
  if (input.allowedValues && new Set(input.allowedValues).size !== input.allowedValues.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["allowedValues"], message: "As opções devem ser únicas." });
  }
});

export const metricMappingSchema = z.object({
  indicatorDefinitionId: z.string().trim().min(1).max(160),
  metricDefinitionId: z.string().trim().min(1).max(160).nullable(),
});

export type MetricDefinitionInput = z.infer<typeof metricDefinitionSchema>;
