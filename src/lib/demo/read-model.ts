import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { calculateDemoCoverage, configuredDemoOrganizationSlug, isEnrollmentEligibleForWave, sumDemoIntegers, sumDemoMoney } from "@/lib/demo/invariants";

export type DemoIndicator = {
  key: string;
  label: string;
  valueType: "INTEGER" | "CURRENCY" | "ENUM";
  unit: string | null;
  position: number;
  allowedValues: string[];
};

export type DemoObservationValue = {
  key: string;
  label: string;
  valueType: DemoIndicator["valueType"];
  unit: string | null;
  integerValue: number | null;
  decimalValue: string | null;
  textValue: string | null;
};

export type DemoObservation = {
  sequence: number;
  waveName: string;
  offsetMonths: number | null;
  status: "PENDING" | "IN_PROGRESS" | "SUBMITTED" | "MISSED";
  submittedAt: string | null;
  values: DemoObservationValue[];
};

export type DemoVenture = {
  slug: string;
  name: string;
  kind: string;
  status: "ACTIVE" | "WITHDRAWN";
  enrolledAt: string;
  withdrawnAt: string | null;
  observations: DemoObservation[];
  milestones: Array<{ type: string; title: string; description: string | null; occurredAt: string }>;
};

export type DemoWave = {
  sequence: number;
  name: string;
  offsetMonths: number | null;
  scheduledFor: string | null;
  status: string;
  expected: number;
  submitted: number;
  pending: number;
  missed: number;
  notExpected: number;
  coverage: number;
};

export type DemoOpportunity = {
  callNumber: string;
  institution: string;
  title: string;
  objective: string;
  territory: string;
  audience: string | null;
  status: string;
  publishedAt: string | null;
  applicationEndsAt: string | null;
  sourceUrl: string;
  sourceCheckedAt: string;
};

export type DemoDataset = {
  organizationName: string;
  program: {
    name: string;
    status: string;
    description: string | null;
    call: {
      title: string;
      shortTitle: string | null;
      callNumber: string;
      objective: string | null;
      status: string;
      publishedAt: string | null;
      totalBudget: string | null;
      maximumSupport: string | null;
      targetProjects: number | null;
      executionMonths: number | null;
      sourceUrl: string;
      sourceCheckedAt: string;
      documents: Array<{ type: string; title: string; externalUrl: string; publishedAt: string | null }>;
    } | null;
  };
  cohort: { name: string; code: string | null; referenceYear: number | null; startsAt: string | null; endsAt: string | null; fundingCallNumber: string | null };
  protocol: { name: string; version: number; label: string | null; indicators: DemoIndicator[] };
  waves: DemoWave[];
  ventures: DemoVenture[];
  opportunities: DemoOpportunity[];
  metrics: {
    ventureCount: number;
    activeVentureCount: number;
    waveCount: number;
    latestWaveName: string;
    latestWaveCoverage: number;
    latestExpected: number;
    latestSubmitted: number;
    latestTeamSize: number;
    venturesWithCustomers: number;
    latestMonthlyRevenue: string;
    latestAdditionalCapital: string;
  };
};

function configuredSlug(): string | null {
  return configuredDemoOrganizationSlug();
}

export function isDemoEnabled(): boolean {
  return process.env.DEMO_ENABLED === "true";
}

export async function hasConfiguredDemoOrganization(): Promise<boolean> {
  if (!isDemoEnabled()) return false;
  const slug = configuredSlug();
  if (!slug) return false;
  const organization = await db.organization.findFirst({ where: { slug, status: "ACTIVE" }, select: { id: true } });
  return Boolean(organization);
}

async function getDemoOrganization() {
  if (!isDemoEnabled()) return null;
  const slug = configuredSlug();
  if (!slug) return null;
  return db.organization.findFirst({ where: { slug, status: "ACTIVE" }, select: { id: true, name: true } });
}

function serializeDate(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function serializeMoney(value: Prisma.Decimal | null): string | null {
  return value?.toString() ?? null;
}

function serializeValue(value: {
  integerValue: number | null;
  decimalValue: Prisma.Decimal | null;
  textValue: string | null;
  indicatorDefinition: { key: string; label: string; valueType: "INTEGER" | "CURRENCY" | "ENUM"; unit: string | null };
}): DemoObservationValue {
  return {
    key: value.indicatorDefinition.key,
    label: value.indicatorDefinition.label,
    valueType: value.indicatorDefinition.valueType,
    unit: value.indicatorDefinition.unit,
    integerValue: value.integerValue,
    decimalValue: value.decimalValue?.toString() ?? null,
    textValue: value.textValue,
  };
}

function getValue(venture: DemoVenture, sequence: number, key: string): DemoObservationValue | undefined {
  return venture.observations.find((observation) => observation.sequence === sequence)?.values.find((value) => value.key === key);
}

function waveDateFromOffset(offsetMonths: number | null, cohortStartsAt: Date | null): string | null {
  if (offsetMonths === null || !cohortStartsAt) return null;
  const date = new Date(cohortStartsAt);
  date.setUTCMonth(date.getUTCMonth() + offsetMonths);
  return date.toISOString();
}

export async function getDemoDataset(): Promise<DemoDataset | null> {
  const organization = await getDemoOrganization();
  if (!organization) return null;

  const program = await db.fundingProgram.findFirst({
    where: { organizationId: organization.id, slug: "centelha-2-se-demo" },
    select: { name: true, status: true, description: true },
  });
  const cohort = await db.cohort.findFirst({
    where: { organizationId: organization.id, code: "centelha-2-se-cenario-demo" },
    select: {
      id: true,
      name: true,
      code: true,
      referenceYear: true,
      startsAt: true,
      endsAt: true,
      fundingCall: {
        select: {
          title: true,
          shortTitle: true,
          callNumber: true,
          objective: true,
          status: true,
          publishedAt: true,
          totalBudget: true,
          maximumSupport: true,
          targetProjects: true,
          executionMonths: true,
          sourceUrl: true,
          sourceCheckedAt: true,
          documents: { select: { type: true, title: true, externalUrl: true, publishedAt: true }, orderBy: { title: "asc" } },
        },
      },
      trackingProtocolVersion: {
        select: {
          version: true,
          label: true,
          trackingProtocol: { select: { name: true } },
          indicators: { orderBy: { position: "asc" }, select: { key: true, label: true, valueType: true, unit: true, position: true, allowedValues: true } },
        },
      },
    },
  });
  if (!program || !cohort || !cohort.trackingProtocolVersion) return null;

  const call = cohort.fundingCall;
  const protocolVersion = cohort.trackingProtocolVersion;

  const [waves, enrollments, observations, milestones, opportunities] = await Promise.all([
    db.followUpWave.findMany({ where: { organizationId: organization.id, cohortId: cohort.id }, orderBy: { sequence: "asc" }, select: { id: true, name: true, sequence: true, offsetMonths: true, scheduledFor: true, status: true } }),
    db.ventureEnrollment.findMany({ where: { organizationId: organization.id, cohortId: cohort.id }, orderBy: { venture: { name: "asc" } }, select: { id: true, status: true, enrolledAt: true, withdrawnAt: true, venture: { select: { slug: true, name: true, kind: true } } } }),
    db.ventureObservation.findMany({
      where: { organizationId: organization.id, cohortId: cohort.id },
      select: {
        id: true,
        status: true,
        submittedAt: true,
        followUpWave: { select: { name: true, sequence: true, offsetMonths: true } },
        ventureEnrollment: { select: { id: true, status: true, enrolledAt: true, venture: { select: { slug: true } } } },
        values: { select: { integerValue: true, decimalValue: true, textValue: true, indicatorDefinition: { select: { key: true, label: true, valueType: true, unit: true } } } },
      },
      orderBy: [{ ventureEnrollment: { venture: { name: "asc" } } }, { followUpWave: { sequence: "asc" } }],
    }),
    db.milestone.findMany({ where: { organizationId: organization.id }, orderBy: [{ occurredAt: "asc" }, { title: "asc" }], select: { type: true, title: true, description: true, occurredAt: true, venture: { select: { slug: true } } } }),
    db.opportunity.findMany({ where: { organizationId: organization.id }, orderBy: [{ status: "asc" }, { publishedAt: "desc" }], select: { callNumber: true, institution: true, title: true, objective: true, territory: true, audience: true, status: true, publishedAt: true, applicationEndsAt: true, sourceUrl: true, sourceCheckedAt: true } }),
  ]);

  const ventureMap = new Map<string, DemoVenture>();
  for (const enrollment of enrollments) {
    if (!enrollment.venture.slug) continue;
    ventureMap.set(enrollment.venture.slug, {
      slug: enrollment.venture.slug,
      name: enrollment.venture.name,
      kind: enrollment.venture.kind,
      status: enrollment.status,
      enrolledAt: enrollment.enrolledAt.toISOString(),
      withdrawnAt: enrollment.withdrawnAt?.toISOString() ?? null,
      observations: [],
      milestones: [],
    });
  }
  for (const observation of observations) {
    const slug = observation.ventureEnrollment.venture.slug;
    if (!slug) continue;
    const venture = ventureMap.get(slug);
    if (!venture) continue;
    venture.observations.push({ sequence: observation.followUpWave.sequence, waveName: observation.followUpWave.name, offsetMonths: observation.followUpWave.offsetMonths, status: observation.status, submittedAt: serializeDate(observation.submittedAt), values: observation.values.map(serializeValue) });
  }
  for (const milestone of milestones) {
    const venture = milestone.venture.slug ? ventureMap.get(milestone.venture.slug) : undefined;
    venture?.milestones.push({ type: milestone.type, title: milestone.title, description: milestone.description, occurredAt: milestone.occurredAt.toISOString() });
  }

  const ventures = Array.from(ventureMap.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const serializedWaves: DemoWave[] = waves.map((wave) => {
    const scheduledFor = serializeDate(wave.scheduledFor) ?? waveDateFromOffset(wave.offsetMonths, cohort.startsAt);
    const expectedVentures = ventures.filter((venture) => isEnrollmentEligibleForWave({ enrolledAt: venture.enrolledAt, withdrawnAt: venture.withdrawnAt }, scheduledFor));
    const waveObservations = expectedVentures.map((venture) => venture.observations.find((observation) => observation.sequence === wave.sequence));
    const submitted = waveObservations.filter((observation) => observation?.status === "SUBMITTED").length;
    const pending = waveObservations.filter((observation) => !observation || observation.status === "PENDING" || observation.status === "IN_PROGRESS").length;
    const missed = waveObservations.filter((observation) => observation?.status === "MISSED").length;
    const expected = expectedVentures.length;
    return { sequence: wave.sequence, name: wave.name, offsetMonths: wave.offsetMonths, scheduledFor, status: wave.status, expected, submitted, pending, missed, notExpected: ventures.length - expected, coverage: calculateDemoCoverage(expected, submitted) };
  });

  const latestWave = serializedWaves.at(-1) ?? { sequence: 0, name: "Sem onda", offsetMonths: 0, scheduledFor: null, status: "PLANNED", expected: 0, submitted: 0, pending: 0, missed: 0, notExpected: 0, coverage: 0 };
  const activeVentures = ventures.filter((venture) => venture.status === "ACTIVE");
  const latestTeamSize = sumDemoIntegers(activeVentures.map((venture) => getValue(venture, latestWave.sequence, "team_size")?.integerValue));
  const venturesWithCustomers = activeVentures.filter((venture) => {
    const value = getValue(venture, latestWave.sequence, "paying_customers")?.integerValue;
    return typeof value === "number" && value > 0;
  }).length;
  const latestMonthlyRevenue = sumDemoMoney(activeVentures.map((venture) => getValue(venture, latestWave.sequence, "monthly_revenue")?.decimalValue ?? null));
  const latestAdditionalCapital = sumDemoMoney(activeVentures.map((venture) => getValue(venture, latestWave.sequence, "additional_capital")?.decimalValue ?? null));

  return {
    organizationName: organization.name,
    program: {
      name: program.name,
      status: program.status,
      description: program.description,
      call: call ? { ...call, publishedAt: serializeDate(call.publishedAt), totalBudget: serializeMoney(call.totalBudget), maximumSupport: serializeMoney(call.maximumSupport), sourceCheckedAt: call.sourceCheckedAt.toISOString(), documents: call.documents.map((document) => ({ ...document, publishedAt: serializeDate(document.publishedAt) })) } : null,
    },
    cohort: { name: cohort.name, code: cohort.code, referenceYear: cohort.referenceYear, startsAt: serializeDate(cohort.startsAt), endsAt: serializeDate(cohort.endsAt), fundingCallNumber: call?.callNumber ?? null },
    protocol: { name: protocolVersion.trackingProtocol.name, version: protocolVersion.version, label: protocolVersion.label, indicators: protocolVersion.indicators.map((indicator) => ({ key: indicator.key, label: indicator.label, valueType: indicator.valueType, unit: indicator.unit, position: indicator.position, allowedValues: Array.isArray(indicator.allowedValues) ? indicator.allowedValues.filter((value): value is string => typeof value === "string") : [] })) },
    waves: serializedWaves,
    ventures,
    opportunities: opportunities.map((opportunity) => ({ ...opportunity, publishedAt: serializeDate(opportunity.publishedAt), applicationEndsAt: serializeDate(opportunity.applicationEndsAt), sourceCheckedAt: opportunity.sourceCheckedAt.toISOString() })),
    metrics: { ventureCount: ventures.length, activeVentureCount: activeVentures.length, waveCount: serializedWaves.length, latestWaveName: latestWave.name, latestWaveCoverage: latestWave.coverage, latestExpected: latestWave.expected, latestSubmitted: latestWave.submitted, latestTeamSize, venturesWithCustomers, latestMonthlyRevenue, latestAdditionalCapital },
  };
}

export async function getDemoVenture(ventureSlug: string): Promise<{ dataset: DemoDataset; venture: DemoVenture } | null> {
  const dataset = await getDemoDataset();
  const venture = dataset?.ventures.find((item) => item.slug === ventureSlug);
  return dataset && venture ? { dataset, venture } : null;
}
