import { z } from "zod";

export const cohortStatusSchema = z.enum(["PLANNED", "ACTIVE", "CLOSED", "ARCHIVED"]);

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();
const optionalDate = z.coerce.date().optional().nullable();

export const createCohortSchema = z.object({
  name: z.string().trim().min(2).max(160),
  code: optionalText(64),
  referenceYear: z.coerce.number().int().min(1900).max(2200).optional().nullable(),
  startsAt: optionalDate,
  endsAt: optionalDate,
  status: cohortStatusSchema.default("PLANNED"),
}).superRefine((input, context) => {
  if (input.startsAt && input.endsAt && input.endsAt < input.startsAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "A data final deve ser posterior à data inicial." });
  }
});

export type CreateCohortInput = z.infer<typeof createCohortSchema>;
