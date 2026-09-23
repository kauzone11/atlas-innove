import { z } from "zod";

export const ventureKindSchema = z.enum(["COMPANY", "PROJECT", "INITIATIVE", "OTHER"]);

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

export const createVentureSchema = z.object({
  name: z.string().trim().min(2).max(160),
  legalName: optionalText(200),
  kind: ventureKindSchema,
  externalReference: optionalText(120),
});

export const updateVentureSchema = createVentureSchema.partial().refine(
  (input) => Object.keys(input).length > 0,
  { message: "Informe ao menos uma alteração." },
);

export const createEnrollmentSchema = z.object({
  ventureId: z.string().cuid(),
  externalReference: optionalText(120),
  enrolledAt: z.coerce.date().optional(),
});

export type CreateVentureInput = z.infer<typeof createVentureSchema>;
export type UpdateVentureInput = z.infer<typeof updateVentureSchema>;
export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;
