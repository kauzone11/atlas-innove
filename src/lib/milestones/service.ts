import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { ResourceNotFoundError } from "@/lib/errors";
import type { CreateMilestoneInput, UpdateMilestoneInput } from "@/lib/milestones/schemas";

const milestoneSelect = { id: true, type: true, title: true, description: true, occurredAt: true, createdAt: true } as const;
type MilestoneRecord = Prisma.MilestoneGetPayload<{ select: typeof milestoneSelect }>;
export type MilestoneDto = Omit<MilestoneRecord, "occurredAt" | "createdAt"> & { occurredAt: string; createdAt: string };

function serializeMilestone(record: MilestoneRecord): MilestoneDto {
  return { ...record, occurredAt: record.occurredAt.toISOString(), createdAt: record.createdAt.toISOString() };
}

export async function listVentureMilestones(organizationId: string, ventureId: string): Promise<MilestoneDto[]> {
  const venture = await db.venture.findFirst({ where: { organizationId, id: ventureId }, select: { id: true } });
  if (!venture) throw new ResourceNotFoundError("VENTURE_NOT_FOUND");
  const records = await db.milestone.findMany({ where: { organizationId, ventureId }, select: milestoneSelect, orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }] });
  return records.map(serializeMilestone);
}

export async function createVentureMilestone(organizationId: string, ventureId: string, input: CreateMilestoneInput): Promise<MilestoneDto> {
  const record = await db.$transaction(async (tx) => {
    const venture = await tx.venture.findFirst({ where: { organizationId, id: ventureId }, select: { id: true } });
    if (!venture) throw new ResourceNotFoundError("VENTURE_NOT_FOUND");
    return tx.milestone.create({ data: { organizationId, ventureId, type: input.type, title: input.title, description: input.description || null, occurredAt: input.occurredAt }, select: milestoneSelect });
  });
  return serializeMilestone(record);
}

export async function updateVentureMilestone(organizationId: string, ventureId: string, milestoneId: string, input: UpdateMilestoneInput): Promise<MilestoneDto> {
  const record = await db.$transaction(async (tx) => {
    const result = await tx.milestone.updateMany({
      where: { organizationId, ventureId, id: milestoneId },
      data: {
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
        ...(input.occurredAt !== undefined ? { occurredAt: input.occurredAt } : {}),
      },
    });
    if (!result.count) throw new ResourceNotFoundError("MILESTONE_NOT_FOUND");
    const updated = await tx.milestone.findFirst({ where: { organizationId, ventureId, id: milestoneId }, select: milestoneSelect });
    if (!updated) throw new ResourceNotFoundError("MILESTONE_NOT_FOUND");
    return updated;
  });
  return serializeMilestone(record);
}
