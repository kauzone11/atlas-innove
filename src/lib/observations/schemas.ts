import { z } from "zod";

export const saveObservationValuesSchema = z.object({
  expectedRevision: z.number().int().min(0),
  submit: z.boolean().default(false),
  values: z.array(z.object({
    indicatorDefinitionId: z.string().trim().min(1).max(160),
    value: z.union([z.string().max(160), z.number().finite(), z.null()]),
  })).max(40),
});

export type SaveObservationValuesInput = z.infer<typeof saveObservationValuesSchema>;
