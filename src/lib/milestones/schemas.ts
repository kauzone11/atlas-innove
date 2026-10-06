import { z } from "zod";

export const createMilestoneSchema = z.object({
  type: z.enum(["MVP_LAUNCHED", "FIRST_CUSTOMER", "COMPANY_FORMALIZED", "RECURRING_CONTRACT", "ADDITIONAL_INVESTMENT", "TEAM_EXPANSION", "PIVOT", "CLOSED"]),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(3000).nullable().optional(),
  occurredAt: z.string().datetime({ offset: true }).pipe(z.coerce.date()),
});

export const updateMilestoneSchema = createMilestoneSchema.partial().refine((input) => Object.keys(input).length > 0, { message: "Informe ao menos uma alteração." });

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
