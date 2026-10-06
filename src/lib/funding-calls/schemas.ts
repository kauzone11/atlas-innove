import { z } from "zod";

export const fundingCallStatusSchema = z.enum(["DRAFT", "OPEN", "IN_REVIEW", "CLOSED", "RESULT_PUBLISHED", "ARCHIVED"]);
export const fundingCallDocumentTypeSchema = z.enum(["NOTICE", "ANNEX", "AMENDMENT", "RESULT", "OTHER"]);

const optionalText = (max: number) => z.string().trim().max(max, `Use até ${max} caracteres.`).optional().nullable();
const optionalDate = z.coerce.date({ errorMap: () => ({ message: "Informe uma data válida." }) }).optional().nullable();
const externalUrl = z.string().trim().max(2048, "O link deve ter até 2048 caracteres.").url("Informe um endereço válido.").refine((value) => /^https?:\/\//i.test(value), "Use um endereço HTTP ou HTTPS.");
const optionalSourceUrl = z.preprocess((value) => typeof value === "string" && !value.trim() ? null : value, externalUrl.optional().nullable());
const optionalMoney = z.preprocess(
  (value) => typeof value === "number" ? String(value) : value,
  z.string().trim().regex(/^\d{1,12}(\.\d{1,2})?$/, "Informe um valor positivo com até duas casas decimais.").optional().nullable(),
);

const callFields = z.object({
  title: z.string().trim().min(2, "O título deve ter ao menos 2 caracteres.").max(200, "O título deve ter até 200 caracteres."),
  shortTitle: optionalText(100),
  callNumber: z.string().trim().min(1, "Informe o número do edital.").max(80, "O número do edital deve ter até 80 caracteres."),
  objective: optionalText(4000),
  status: fundingCallStatusSchema.default("DRAFT"),
  applicationsEnabled: z.boolean().default(false),
  publishedAt: optionalDate,
  applicationStartsAt: optionalDate,
  applicationEndsAt: optionalDate,
  totalBudget: optionalMoney,
  maximumSupport: optionalMoney,
  targetProjects: z.coerce.number().int().positive().max(1000000).optional().nullable(),
  executionMonths: z.coerce.number().int().positive().max(1200).optional().nullable(),
  sourceUrl: optionalSourceUrl,
});

function validateDates(input: { applicationStartsAt?: Date | null; applicationEndsAt?: Date | null }, context: z.RefinementCtx) {
  if (input.applicationStartsAt && input.applicationEndsAt && input.applicationEndsAt < input.applicationStartsAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["applicationEndsAt"], message: "O encerramento deve ser posterior à abertura das inscrições." });
  }
}

export const createFundingCallSchema = callFields.superRefine(validateDates);
export const updateFundingCallSchema = callFields.partial().superRefine(validateDates).refine((input) => Object.keys(input).length > 0, "Informe ao menos uma alteração.");
export const createFundingCallDocumentSchema = z.object({
  type: fundingCallDocumentTypeSchema.default("OTHER"),
  title: z.string().trim().min(2, "O título deve ter ao menos 2 caracteres.").max(200, "O título deve ter até 200 caracteres."),
  externalUrl,
  publishedAt: optionalDate,
});

export type CreateFundingCallInput = z.infer<typeof createFundingCallSchema>;
export type UpdateFundingCallInput = z.infer<typeof updateFundingCallSchema>;
export type CreateFundingCallDocumentInput = z.infer<typeof createFundingCallDocumentSchema>;
