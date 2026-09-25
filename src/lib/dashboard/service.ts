import { db } from "@/lib/db";

export type DashboardProgramDto = {
  id: string;
  name: string;
  code: string | null;
  status: string;
  cohortCount: number;
  ventureCount: number;
  waveCount: number;
  submittedObservationCount: number;
  observationCount: number;
  nextDate: string | null;
  nextLabel: string | null;
};

export type FollowUpQueueItemDto = {
  id: string;
  ventureId: string;
  ventureName: string;
  cohortId: string;
  cohortName: string;
  programName: string;
  waveId: string;
  waveName: string;
  waveSequence: number;
  status: string;
  dueAt: string | null;
  bucket: "TODAY" | "OVERDUE" | "REVIEW" | "UPCOMING" | "COMPLETED";
};

export type OrganizationDashboardDto = {
  metrics: {
    activeProgramCount: number;
    ventureCount: number;
    openFollowUpCount: number;
    overdueCount: number;
    coverage: number | null;
  };
  programs: DashboardProgramDto[];
  queue: FollowUpQueueItemDto[];
};

function startOfTodayInFortaleza(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function localDateKey(value: Date | null): string | null {
  if (!value) return null;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function classifyQueueItem(status: string, dueAt: Date | null, today: string): FollowUpQueueItemDto["bucket"] {
  if (status === "SUBMITTED") return "COMPLETED";
  if (status === "MISSED") return "OVERDUE";
  const dueKey = localDateKey(dueAt);
  if (dueKey && dueKey < today) return "OVERDUE";
  if (status === "IN_PROGRESS") return "REVIEW";
  if (dueKey === today) return "TODAY";
  return "UPCOMING";
}

export async function getOrganizationDashboard(organizationId: string): Promise<OrganizationDashboardDto> {
  const [programRecords, observations, ventureCount] = await Promise.all([
    db.fundingProgram.findMany({
      where: { organizationId },
      orderBy: [{ status: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        cohorts: {
          select: {
            id: true,
            _count: { select: { enrollments: true } },
            followUpWaves: {
              select: {
                name: true,
                scheduledFor: true,
                opensAt: true,
                observations: { select: { status: true } },
              },
            },
          },
        },
      },
    }),
    db.ventureObservation.findMany({
      where: { organizationId },
      orderBy: [{ followUpWave: { scheduledFor: "asc" } }, { updatedAt: "desc" }],
      select: {
        id: true,
        status: true,
        followUpWave: {
          select: {
            id: true,
            name: true,
            sequence: true,
            scheduledFor: true,
            opensAt: true,
            closesAt: true,
            cohort: { select: { id: true, name: true, fundingProgram: { select: { name: true } } } },
          },
        },
        ventureEnrollment: { select: { ventureId: true, venture: { select: { name: true, archivedAt: true } } } },
      },
    }),
    db.venture.count({ where: { organizationId, archivedAt: null } }),
  ]);

  const today = startOfTodayInFortaleza();
  const programs = programRecords.map((program) => {
    const waves = program.cohorts.flatMap((cohort) => cohort.followUpWaves);
    const observationStatuses = waves.flatMap((wave) => wave.observations.map((observation) => observation.status));
    const datedWaves = waves
      .map((wave) => ({ ...wave, date: wave.scheduledFor ?? wave.opensAt }))
      .filter((wave): wave is typeof wave & { date: Date } => Boolean(wave.date))
      .sort((left, right) => left.date.getTime() - right.date.getTime());
    const nextWave = datedWaves.find((wave) => (localDateKey(wave.date) ?? "") >= today);
    return {
      id: program.id,
      name: program.name,
      code: program.code,
      status: program.status,
      cohortCount: program.cohorts.length,
      ventureCount: program.cohorts.reduce((total, cohort) => total + cohort._count.enrollments, 0),
      waveCount: waves.length,
      submittedObservationCount: observationStatuses.filter((status) => status === "SUBMITTED").length,
      observationCount: observationStatuses.length,
      nextDate: nextWave?.date.toISOString() ?? null,
      nextLabel: nextWave?.name ?? null,
    } satisfies DashboardProgramDto;
  });

  const queue = observations
    .filter((observation) => !observation.ventureEnrollment.venture.archivedAt)
    .map((observation) => {
      const wave = observation.followUpWave;
      const dueAt = wave.scheduledFor ?? wave.closesAt ?? wave.opensAt;
      return {
        id: observation.id,
        ventureId: observation.ventureEnrollment.ventureId,
        ventureName: observation.ventureEnrollment.venture.name,
        cohortId: wave.cohort.id,
        cohortName: wave.cohort.name,
        programName: wave.cohort.fundingProgram.name,
        waveId: wave.id,
        waveName: wave.name,
        waveSequence: wave.sequence,
        status: observation.status,
        dueAt: dueAt?.toISOString() ?? null,
        bucket: classifyQueueItem(observation.status, dueAt, today),
      } satisfies FollowUpQueueItemDto;
    })
    .sort((left, right) => {
      const rank = { OVERDUE: 0, TODAY: 1, REVIEW: 2, UPCOMING: 3, COMPLETED: 4 } satisfies Record<FollowUpQueueItemDto["bucket"], number>;
      return rank[left.bucket] - rank[right.bucket] || (left.dueAt ?? "9999").localeCompare(right.dueAt ?? "9999");
    });

  const observationCount = programs.reduce((total, program) => total + program.observationCount, 0);
  const submittedObservationCount = programs.reduce((total, program) => total + program.submittedObservationCount, 0);
  const activeProgramCount = programRecords.filter((program) => program.status === "ACTIVE").length;
  return {
    metrics: {
      activeProgramCount,
      ventureCount,
      openFollowUpCount: queue.filter((item) => item.bucket !== "COMPLETED").length,
      overdueCount: queue.filter((item) => item.bucket === "OVERDUE").length,
      coverage: observationCount ? Math.round((submittedObservationCount / observationCount) * 100) : null,
    },
    programs,
    queue,
  };
}
