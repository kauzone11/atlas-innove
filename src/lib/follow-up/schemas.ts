import { z } from "zod";

export const followUpWaveKindSchema = z.enum(["BASELINE", "FOLLOW_UP"]);
export const followUpWaveStatusSchema = z.enum(["PLANNED", "OPEN", "CLOSED", "ARCHIVED"]);

const optionalDate = z.coerce.date().optional().nullable();

export const createFollowUpWaveSchema = z.object({
  name: z.string().trim().min(2).max(160),
  kind: followUpWaveKindSchema.default("FOLLOW_UP"),
  sequence: z.coerce.number().int().min(0),
  offsetMonths: z.coerce.number().int().min(0).optional().nullable(),
  scheduledFor: optionalDate,
  opensAt: optionalDate,
  closesAt: optionalDate,
}).superRefine((input, context) => {
  if (input.opensAt && input.closesAt && input.closesAt < input.opensAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["closesAt"],
      message: "A data de encerramento deve ser posterior à abertura.",
    });
  }
});

export const updateFollowUpWaveStatusSchema = z.object({
  status: followUpWaveStatusSchema,
});

export const updateObservationStatusSchema = z.object({
  status: z.enum(["IN_PROGRESS", "MISSED"]),
});

export type CreateFollowUpWaveInput = z.infer<typeof createFollowUpWaveSchema>;
export type UpdateFollowUpWaveStatusInput = z.infer<typeof updateFollowUpWaveStatusSchema>;
export type UpdateObservationStatusInput = z.infer<typeof updateObservationStatusSchema>;
