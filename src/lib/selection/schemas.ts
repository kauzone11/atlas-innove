import { z } from "zod";

const id = z.string().min(1).max(200);
const decimal = z.union([z.string(), z.number()]).transform(String).refine((value) => /^\d{1,6}(\.\d{1,4})?$/.test(value), "Informe um número não negativo com até quatro casas decimais.");
const positiveDecimal = decimal.refine((value) => Number(value) > 0, "Informe um valor maior que zero.");

export const createApplicationSchema = z.object({ projectId: id, fundingCallId: id, teamId: id.nullable().optional(), organizationId: id.optional() }).strict();
export const updateApplicationSchema = z.object({
  revision: z.number().int().nonnegative(),
  teamId: id.nullable().optional(),
  projectNameSnapshot: z.string().trim().min(2).max(180).optional(),
  projectSummarySnapshot: z.string().trim().min(10).max(2000).optional(),
  projectDescriptionSnapshot: z.string().trim().max(15000).nullable().optional(),
}).strict();
export const applicationRevisionSchema = z.object({ revision: z.number().int().nonnegative() }).strict();
export const criterionSchema = z.object({ name: z.string().trim().min(2).max(180), description: z.string().trim().max(3000).nullable().optional(), weight: positiveDecimal, maxScore: positiveDecimal, position: z.number().int().nonnegative().max(10000).default(0) }).strict();
export const reorderCriteriaSchema = z.object({ criterionIds: z.array(id).min(1).max(100) }).strict();
export const evaluationSchema = z.object({ revision: z.number().int().nonnegative(), scores: z.array(z.object({ criterionId: id, score: decimal, comment: z.string().trim().max(4000).nullable().optional() }).strict()).max(100), submit: z.boolean() }).strict();
export const decisionSchema = z.object({ applicationIds: z.array(id).min(1).max(200), decision: z.enum(["SELECTED", "WAITLIST", "NOT_SELECTED", "DISQUALIFIED"]), decisionNote: z.string().trim().max(4000).nullable().optional() }).strict();
export const enrollmentMappingSchema = z.object({ applicationId: id, ventureId: id.nullable().optional(), kind: z.enum(["PROJECT", "COMPANY", "INITIATIVE", "OTHER"]).optional() }).strict();
export const enrollApplicationsSchema = z.object({ cohortId: id, applicationIds: z.array(id).min(1).max(200), mappings: z.array(enrollmentMappingSchema).max(200).optional() }).strict();
export type EnrollmentMapping = z.infer<typeof enrollmentMappingSchema>;

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
export type CriterionInput = z.infer<typeof criterionSchema>;
export type EvaluationInput = z.infer<typeof evaluationSchema>;
export type DecisionInput = z.infer<typeof decisionSchema>;
