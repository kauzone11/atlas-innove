import { z } from "zod";

export const fundingProgramStatusSchema = z.enum(["DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"]);

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

export const createFundingProgramSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(64),
  description: optionalText(2000),
  code: optionalText(64),
  status: fundingProgramStatusSchema.default("DRAFT"),
});

export const updateFundingProgramSchema = createFundingProgramSchema.partial().refine(
  (input) => Object.keys(input).length > 0,
  { message: "Informe ao menos uma alteração." },
);

export type CreateFundingProgramInput = z.infer<typeof createFundingProgramSchema>;
export type UpdateFundingProgramInput = z.infer<typeof updateFundingProgramSchema>;
