import type { Prisma } from "@prisma/client";
import { AuthorizationError } from "@/lib/auth/authorization";
import { requireProjectAccess } from "@/lib/auth/participant-access";
import { db } from "@/lib/db";
import { DomainConflictError, ResourceNotFoundError } from "@/lib/errors";
import { createResourceSchema, createTaskSchema, removeResourceSchema, updateResourceSchema, updateTaskSchema } from "@/lib/project-collaboration/schemas";
import { canTransitionTask, isTaskOverdue, taskIsTerminal } from "@/lib/project-collaboration/state";

const personSelect = { id: true, email: true, profile: { select: { fullName: true } } } as const;
const taskSelect = {
  id: true, projectId: true, title: true, description: true, status: true, priority: true,
  assigneeUserId: true, assignee: { select: personSelect }, dueAt: true, completedAt: true,
  cancelledAt: true, revision: true, createdAt: true, updatedAt: true,
} as const;
const resourceSelect = { id: true, projectId: true, type: true, label: true, url: true, description: true, revision: true, createdAt: true, updatedAt: true, createdBy: { select: personSelect } } as const;
type TaskRecord = Prisma.ProjectTaskGetPayload<{ select: typeof taskSelect }>;
type ResourceRecord = Prisma.ProjectResourceGetPayload<{ select: typeof resourceSelect }>;
type Access = Awaited<ReturnType<typeof requireProjectAccess>>;
export type ProjectCollaboratorDto = { userId: string; fullName: string };
export type ProjectTaskDto = ReturnType<typeof taskDto>;
export type ProjectResourceDto = ReturnType<typeof resourceDto>;
export type ProjectTaskFilter = "all" | "pending" | "completed";
export type ProjectCollaborationDto = { tasks: ProjectTaskDto[]; resources: ProjectResourceDto[]; collaborators: ProjectCollaboratorDto[]; canManage: boolean; taskPage: number; taskPageSize: number; taskTotal: number; taskFilter: ProjectTaskFilter };

function taskDto(task: TaskRecord, userId: string, access: Access, collaborators: ProjectCollaboratorDto[]) {
  const active = !access.archivedAt && access.status !== "ARCHIVED";
  return {
    id: task.id, projectId: task.projectId, title: task.title, description: task.description,
    status: task.status, priority: task.priority, revision: task.revision,
    assigneeUserId: task.assigneeUserId, assigneeName: task.assignee?.profile?.fullName ?? task.assignee?.email ?? null,
    assigneeHasCurrentAccess: Boolean(task.assigneeUserId && collaborators.some((person) => person.userId === task.assigneeUserId)),
    dueAt: task.dueAt?.toISOString().slice(0, 10) ?? null,
    completedAt: task.completedAt?.toISOString() ?? null, cancelledAt: task.cancelledAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(), updatedAt: task.updatedAt.toISOString(),
    overdue: isTaskOverdue({ status: task.status, dueAt: task.dueAt?.toISOString() ?? null }),
    canEdit: access.canManage && !taskIsTerminal(task.status),
    canChangeStatus: active && !taskIsTerminal(task.status) && (access.canManage || task.assigneeUserId === userId),
  };
}
function resourceDto(resource: ResourceRecord, canManage: boolean) {
  return { id: resource.id, projectId: resource.projectId, type: resource.type, label: resource.label, url: resource.url,
    description: resource.description, host: new URL(resource.url).hostname, revision: resource.revision,
    createdByName: resource.createdBy.profile?.fullName ?? resource.createdBy.email,
    createdAt: resource.createdAt.toISOString(), updatedAt: resource.updatedAt.toISOString(), canManage };
}

async function currentCollaborators(projectId: string, client: Prisma.TransactionClient = db): Promise<ProjectCollaboratorDto[]> {
  const project = await client.project.findUniqueOrThrow({ where: { id: projectId }, select: {
    memberships: { where: { leftAt: null }, select: { user: { select: personSelect } } },
    primaryTeam: { select: { archivedAt: true, memberships: { where: { status: "ACTIVE", leftAt: null }, select: { user: { select: personSelect } } } } },
  } });
  const users = [...project.memberships.map((member) => member.user), ...(!project.primaryTeam?.archivedAt ? project.primaryTeam?.memberships.map((member) => member.user) ?? [] : [])];
  return [...new Map(users.map((user) => [user.id, { userId: user.id, fullName: user.profile?.fullName ?? user.email }])).values()]
    .sort((left, right) => left.fullName.localeCompare(right.fullName, "pt-BR"));
}

async function lockedAccess(userId: string, projectId: string, client: Prisma.TransactionClient, manage: boolean) {
  // The same team -> project lock order used by membership changes keeps assignment and access checks atomic.
  const initial = await client.project.findUnique({ where: { id: projectId }, select: { primaryTeamId: true } });
  if (initial?.primaryTeamId) await client.$queryRaw`SELECT "id" FROM "Team" WHERE "id" = ${initial.primaryTeamId} FOR UPDATE`;
  await client.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${projectId} FOR UPDATE`;
  const access = await requireProjectAccess(userId, projectId, false, client);
  if (access.primaryTeamId !== initial?.primaryTeamId) throw new DomainConflictError("PROJECT_CONCURRENT_CHANGE");
  if (access.archivedAt || access.status === "ARCHIVED") throw new DomainConflictError("PROJECT_ARCHIVED");
  if (manage && !access.canManage) throw new AuthorizationError("PARTICIPANT_ROLE_FORBIDDEN");
  return access;
}

export async function getProjectCollaboration(userId: string, projectId: string, options: { taskFilter?: ProjectTaskFilter; taskPage?: number } = {}): Promise<ProjectCollaborationDto> {
  const access = await requireProjectAccess(userId, projectId);
  const taskFilter = options.taskFilter ?? "all";
  const taskPage = Math.max(1, Math.min(10000, Number.isFinite(options.taskPage) ? Math.floor(options.taskPage!) : 1));
  const taskPageSize = 100;
  const taskWhere: Prisma.ProjectTaskWhereInput = { projectId, ...(taskFilter === "pending" ? { status: { in: ["TODO", "IN_PROGRESS"] } } : taskFilter === "completed" ? { status: { in: ["DONE", "CANCELLED"] } } : {}) };
  const [collaborators, tasks, resources, taskTotal] = await Promise.all([
    currentCollaborators(projectId),
    db.projectTask.findMany({ where: taskWhere, select: taskSelect, orderBy: [...(taskFilter === "all" ? [{ status: "asc" as const }] : []), { dueAt: "asc" }, { createdAt: "desc" }, { id: "asc" }], take: taskPageSize, skip: (taskPage - 1) * taskPageSize }),
    db.projectResource.findMany({ where: { projectId }, select: resourceSelect, orderBy: { createdAt: "desc" }, take: 100 }),
    db.projectTask.count({ where: taskWhere }),
  ]);
  return { collaborators, canManage: access.canManage, taskPage, taskPageSize, taskTotal, taskFilter, tasks: tasks.map((task) => taskDto(task, userId, access, collaborators)), resources: resources.map((resource) => resourceDto(resource, access.canManage)) };
}

export async function createProjectTask(userId: string, projectId: string, value: unknown): Promise<ProjectTaskDto> {
  const input = createTaskSchema.parse(value);
  return db.$transaction(async (client) => {
    const access = await lockedAccess(userId, projectId, client, true);
    const collaborators = await currentCollaborators(projectId, client);
    if (input.assigneeUserId && !collaborators.some((person) => person.userId === input.assigneeUserId)) throw new DomainConflictError("PROJECT_TASK_ASSIGNEE_ACCESS_REQUIRED");
    if (await client.projectTask.count({ where: { projectId, status: { in: ["TODO", "IN_PROGRESS"] } } }) >= 500) throw new DomainConflictError("PROJECT_TASK_LIMIT");
    const task = await client.projectTask.create({ data: { ...input, dueAt: input.dueAt ? new Date(`${input.dueAt}T00:00:00.000Z`) : null, projectId, createdByUserId: userId }, select: taskSelect });
    return taskDto(task, userId, access, collaborators);
  });
}

export async function updateProjectTask(userId: string, projectId: string, taskId: string, value: unknown): Promise<ProjectTaskDto> {
  const input = updateTaskSchema.parse(value);
  return db.$transaction(async (client) => {
    const access = await lockedAccess(userId, projectId, client, false);
    const task = await client.projectTask.findFirst({ where: { id: taskId, projectId }, select: taskSelect });
    if (!task) throw new ResourceNotFoundError("PROJECT_TASK_NOT_FOUND");
    // A member may only change the status of their assigned task; fields and assignments require OWNER/LEAD.
    if (!access.canManage && (task.assigneeUserId !== userId || Object.keys(input).some((key) => !["status", "expectedRevision"].includes(key)))) throw new AuthorizationError("PARTICIPANT_ROLE_FORBIDDEN");
    if (task.revision !== input.expectedRevision) throw new DomainConflictError("PROJECT_TASK_REVISION_CONFLICT");
    if (taskIsTerminal(task.status)) throw new DomainConflictError("PROJECT_TASK_TERMINAL");
    if (input.status && !canTransitionTask(task.status, input.status)) throw new DomainConflictError("PROJECT_TASK_STATUS_TRANSITION_INVALID");
    const collaborators = await currentCollaborators(projectId, client);
    if (input.assigneeUserId && !collaborators.some((person) => person.userId === input.assigneeUserId)) throw new DomainConflictError("PROJECT_TASK_ASSIGNEE_ACCESS_REQUIRED");
    const { expectedRevision, dueAt, ...fields } = input;
    const result = await client.projectTask.updateMany({ where: { id: taskId, projectId, revision: expectedRevision }, data: {
      ...fields, ...(dueAt === undefined ? {} : { dueAt: dueAt ? new Date(`${dueAt}T00:00:00.000Z`) : null }),
      ...(input.status === "DONE" ? { completedAt: new Date() } : {}), ...(input.status === "CANCELLED" ? { cancelledAt: new Date() } : {}), revision: { increment: 1 },
    } });
    if (result.count !== 1) throw new DomainConflictError("PROJECT_TASK_REVISION_CONFLICT");
    return taskDto(await client.projectTask.findFirstOrThrow({ where: { id: taskId, projectId }, select: taskSelect }), userId, access, collaborators);
  });
}

export async function createProjectResource(userId: string, projectId: string, value: unknown): Promise<ProjectResourceDto> {
  const input = createResourceSchema.parse(value);
  return db.$transaction(async (client) => {
    const access = await lockedAccess(userId, projectId, client, true);
    if (await client.projectResource.count({ where: { projectId } }) >= 100) throw new DomainConflictError("PROJECT_RESOURCE_LIMIT");
    return resourceDto(await client.projectResource.create({ data: { ...input, projectId, createdByUserId: userId }, select: resourceSelect }), access.canManage);
  });
}
export async function updateProjectResource(userId: string, projectId: string, resourceId: string, value: unknown): Promise<ProjectResourceDto> {
  const input = updateResourceSchema.parse(value);
  return db.$transaction(async (client) => {
    const access = await lockedAccess(userId, projectId, client, true);
    const resource = await client.projectResource.findFirst({ where: { id: resourceId, projectId }, select: resourceSelect });
    if (!resource) throw new ResourceNotFoundError("PROJECT_RESOURCE_NOT_FOUND");
    if (resource.revision !== input.expectedRevision) throw new DomainConflictError("PROJECT_RESOURCE_REVISION_CONFLICT");
    const { expectedRevision, ...fields } = input;
    const result = await client.projectResource.updateMany({ where: { id: resourceId, projectId, revision: expectedRevision }, data: { ...fields, revision: { increment: 1 } } });
    if (result.count !== 1) throw new DomainConflictError("PROJECT_RESOURCE_REVISION_CONFLICT");
    return resourceDto(await client.projectResource.findFirstOrThrow({ where: { id: resourceId, projectId }, select: resourceSelect }), access.canManage);
  });
}
export async function removeProjectResource(userId: string, projectId: string, resourceId: string, value: unknown): Promise<void> {
  const input = removeResourceSchema.parse(value);
  await db.$transaction(async (client) => {
    await lockedAccess(userId, projectId, client, true);
    const resource = await client.projectResource.findFirst({ where: { id: resourceId, projectId }, select: { revision: true } });
    if (!resource) throw new ResourceNotFoundError("PROJECT_RESOURCE_NOT_FOUND");
    if (resource.revision !== input.expectedRevision) throw new DomainConflictError("PROJECT_RESOURCE_REVISION_CONFLICT");
    await client.projectResource.delete({ where: { id: resourceId } });
  });
}
