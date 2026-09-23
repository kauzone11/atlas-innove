import { z } from "zod";

export const cohortStatusSchema = z.enum(["PLANNED", "ACTIVE", "CLOSED", "ARCHIVED"]);

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();
const optionalDate = z.coerce.date().optional().nullable();

const cohortFields = z.object({
  name: z.string().trim().min(2).max(160),
  code: optionalText(64),
  referenceYear: z.coerce.number().int().min(1900).max(2200).optional().nullable(),
  startsAt: optionalDate,
  endsAt: optionalDate,
  status: cohortStatusSchema.default("PLANNED"),
});

function validateCohortDates(input: { startsAt?: Date | null; endsAt?: Date | null }, context: z.RefinementCtx): void {
  if (input.startsAt && input.endsAt && input.endsAt < input.startsAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "A data final deve ser posterior à data inicial." });
  }
}

export const createCohortSchema = cohortFields.superRefine(validateCohortDates);

export const updateCohortSchema = cohortFields.partial().superRefine(validateCohortDates).refine(
  (input) => Object.keys(input).length > 0,
  { message: "Informe ao menos uma alteração." },
);

export type CreateCohortInput = z.infer<typeof createCohortSchema>;
export type UpdateCohortInput = z.infer<typeof updateCohortSchema>;
