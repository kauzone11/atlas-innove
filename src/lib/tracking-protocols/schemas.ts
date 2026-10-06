import { z } from "zod";

export const indicatorValueTypeSchema = z.enum(["INTEGER", "CURRENCY", "ENUM"]);

export const indicatorDefinitionSchema = z.object({
  key: z.string().trim().min(1).max(80).regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().trim().min(2).max(160),
  valueType: indicatorValueTypeSchema,
  unit: z.string().trim().max(40).optional().nullable(),
  allowedValues: z.array(z.string().trim().min(1).max(120)).max(30).optional().nullable(),
  metricDefinitionId: z.string().trim().min(1).max(160).optional().nullable(),
}).superRefine((input, context) => {
  if (input.valueType === "ENUM" && !input.allowedValues?.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["allowedValues"], message: "Informe as opções do indicador." });
  }
  if (input.valueType !== "ENUM" && input.allowedValues?.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["allowedValues"], message: "Apenas categorias podem ter opções." });
  }
  if (input.allowedValues && new Set(input.allowedValues).size !== input.allowedValues.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["allowedValues"], message: "As opções devem ser únicas." });
  }
});

export const createProtocolVersionSchema = z.object({
  protocolId: z.string().trim().min(1).max(160).optional(),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  label: z.string().trim().max(300).optional().nullable(),
  indicators: z.array(indicatorDefinitionSchema).min(1).max(40),
}).superRefine((input, context) => {
  if (new Set(input.indicators.map((indicator) => indicator.key)).size !== input.indicators.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["indicators"], message: "Cada indicador precisa de uma chave única." });
  }
});

export type CreateProtocolVersionInput = z.infer<typeof createProtocolVersionSchema>;
