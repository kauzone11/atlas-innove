import { randomBytes } from "node:crypto";

import { hash } from "bcryptjs";

import { db } from "../src/lib/db";
import {
  DEMO_COHORT_CODE,
  DEMO_ORGANIZATION_SLUG,
  DEMO_PROGRAM_SLUG,
  DEMO_PROTOCOL_SLUG,
  demoIndicatorDefinitions,
  demoOpportunities,
  demoVentureFixtures,
  demoWaves,
} from "../src/demo/fixtures";

const sourceCheckedAt = new Date("2026-09-24T12:00:00.000Z");
const demoSeedUserId = "demo-seed-user";

function date(value: string): Date {
  return new Date(`${value}T12:00:00.000Z`);
}

async function main() {
  const unusableDemoPasswordHash = await hash(randomBytes(32).toString("base64url"), 12);
  const seedUser = await db.user.upsert({
    where: { id: demoSeedUserId },
    update: { email: "demo-seed@atlas-innove.invalid", passwordHash: unusableDemoPasswordHash, platformRole: "USER" },
    create: { id: demoSeedUserId, email: "demo-seed@atlas-innove.invalid", passwordHash: unusableDemoPasswordHash, platformRole: "USER" },
    select: { id: true },
  });

  const organization = await db.organization.upsert({
    where: { slug: DEMO_ORGANIZATION_SLUG },
    update: { name: "Atlas Innove · Demonstração", status: "ACTIVE" },
    create: { id: "demo-organization", name: "Atlas Innove · Demonstração", slug: DEMO_ORGANIZATION_SLUG, status: "ACTIVE" },
    select: { id: true },
  });

  const program = await db.fundingProgram.upsert({
    where: { organizationId_slug: { organizationId: organization.id, slug: DEMO_PROGRAM_SLUG } },
    update: {
      name: "Programa Centelha 2 · Sergipe",
      description: "Cenário demonstrativo inspirado no Programa Centelha 2 — SE, com metadados públicos do edital e resultados fictícios.",
      code: "CENTELHA-2-SE",
      status: "CLOSED",
    },
    create: {
      id: "demo-program-centelha-2-se",
      organizationId: organization.id,
      createdByUserId: seedUser.id,
      name: "Programa Centelha 2 · Sergipe",
      slug: DEMO_PROGRAM_SLUG,
      description: "Cenário demonstrativo inspirado no Programa Centelha 2 — SE, com metadados públicos do edital e resultados fictícios.",
      code: "CENTELHA-2-SE",
      status: "CLOSED",
    },
    select: { id: true },
  });

  const call = await db.fundingCall.upsert({
    where: { organizationId_callNumber: { organizationId: organization.id, callNumber: "11/2021" } },
    update: {
      fundingProgramId: program.id,
      title: "Edital nº 11/2021 · Programa Nacional de Apoio à Geração de Empreendimentos Inovadores · Programa Centelha 2 — SE",
      shortTitle: "Centelha 2 · SE",
      objective: "Estimular o empreendedorismo inovador e apoiar a transformação de ideias em empreendimentos de base tecnológica em Sergipe.",
      status: "CLOSED",
      publishedAt: date("2021-12-03"),
      totalBudget: "1200000.00",
      maximumSupport: "53333.33",
      targetProjects: 23,
      executionMonths: 12,
      sourceUrl: "https://fapitec.se.gov.br/editais-em-andamento/edital-no-11-2021-programa-nacional-de-apoio-a-geracao-de-empreendimentos-inovadores-programa-centelha-2-se/",
      sourceCheckedAt,
    },
    create: {
      id: "demo-call-11-2021",
      organizationId: organization.id,
      fundingProgramId: program.id,
      title: "Edital nº 11/2021 · Programa Nacional de Apoio à Geração de Empreendimentos Inovadores · Programa Centelha 2 — SE",
      shortTitle: "Centelha 2 · SE",
      callNumber: "11/2021",
      objective: "Estimular o empreendedorismo inovador e apoiar a transformação de ideias em empreendimentos de base tecnológica em Sergipe.",
      status: "CLOSED",
      publishedAt: date("2021-12-03"),
      totalBudget: "1200000.00",
      maximumSupport: "53333.33",
      targetProjects: 23,
      executionMonths: 12,
      sourceUrl: "https://fapitec.se.gov.br/editais-em-andamento/edital-no-11-2021-programa-nacional-de-apoio-a-geracao-de-empreendimentos-inovadores-programa-centelha-2-se/",
      sourceCheckedAt,
    },
    select: { id: true },
  });

  await db.fundingCallDocument.upsert({
    where: { organizationId_fundingCallId_title: { organizationId: organization.id, fundingCallId: call.id, title: "Edital oficial" } },
    update: { type: "NOTICE", externalUrl: "https://fapitec.se.gov.br/editais-em-andamento/edital-no-11-2021-programa-nacional-de-apoio-a-geracao-de-empreendimentos-inovadores-programa-centelha-2-se/", publishedAt: date("2021-12-03") },
    create: {
      id: "demo-call-11-2021-notice",
      organizationId: organization.id,
      fundingCallId: call.id,
      type: "NOTICE",
      title: "Edital oficial",
      externalUrl: "https://fapitec.se.gov.br/editais-em-andamento/edital-no-11-2021-programa-nacional-de-apoio-a-geracao-de-empreendimentos-inovadores-programa-centelha-2-se/",
      publishedAt: date("2021-12-03"),
    },
  });

  const cohort = await db.cohort.upsert({
    where: { organizationId_fundingProgramId_code: { organizationId: organization.id, fundingProgramId: program.id, code: DEMO_COHORT_CODE } },
    update: { name: "Coorte demonstrativa · Centelha 2", referenceYear: 2023, startsAt: date("2023-02-14"), endsAt: date("2025-02-14"), status: "CLOSED", fundingCallId: call.id },
    create: {
      id: "demo-cohort-centelha-2",
      organizationId: organization.id,
      fundingProgramId: program.id,
      name: "Coorte demonstrativa · Centelha 2",
      code: DEMO_COHORT_CODE,
      referenceYear: 2023,
      startsAt: date("2023-02-14"),
      endsAt: date("2025-02-14"),
      status: "CLOSED",
      fundingCallId: call.id,
    },
    select: { id: true },
  });

  const protocol = await db.trackingProtocol.upsert({
    where: { organizationId_slug: { organizationId: organization.id, slug: DEMO_PROTOCOL_SLUG } },
    update: { name: "Acompanhamento de empreendimentos inovadores", description: "Protocolo demonstrativo para comparação longitudinal de uma coorte fictícia." },
    create: {
      id: "demo-tracking-protocol",
      organizationId: organization.id,
      slug: DEMO_PROTOCOL_SLUG,
      name: "Acompanhamento de empreendimentos inovadores",
      description: "Protocolo demonstrativo para comparação longitudinal de uma coorte fictícia.",
    },
    select: { id: true },
  });

  const protocolVersion = await db.trackingProtocolVersion.upsert({
    where: { organizationId_trackingProtocolId_version: { organizationId: organization.id, trackingProtocolId: protocol.id, version: 1 } },
    update: { label: "Versão demonstrativa · 1" },
    create: { id: "demo-tracking-protocol-v1", organizationId: organization.id, trackingProtocolId: protocol.id, version: 1, label: "Versão demonstrativa · 1" },
    select: { id: true },
  });

  await db.cohort.update({
    where: { id: cohort.id },
    data: { trackingProtocolVersionId: protocolVersion.id },
  });

  const definitions = new Map<string, { id: string }>();
  for (const definition of demoIndicatorDefinitions) {
    const record = await db.indicatorDefinition.upsert({
      where: { organizationId_trackingProtocolVersionId_key: { organizationId: organization.id, trackingProtocolVersionId: protocolVersion.id, key: definition.key } },
      update: { label: definition.label, valueType: definition.valueType, unit: definition.unit, position: definition.position, allowedValues: definition.allowedValues ?? undefined },
      create: { id: `demo-indicator-${definition.key}`, organizationId: organization.id, trackingProtocolVersionId: protocolVersion.id, ...definition },
      select: { id: true },
    });
    definitions.set(definition.key, record);
  }

  const waves = new Map<number, { id: string }>();
  for (const wave of demoWaves) {
    const record = await db.followUpWave.upsert({
      where: { organizationId_cohortId_sequence: { organizationId: organization.id, cohortId: cohort.id, sequence: wave.sequence } },
      update: { name: wave.name, kind: wave.kind, offsetMonths: wave.offsetMonths, scheduledFor: date(wave.scheduledFor), status: wave.status },
      create: { id: `demo-wave-${wave.sequence}`, organizationId: organization.id, cohortId: cohort.id, name: wave.name, kind: wave.kind, sequence: wave.sequence, offsetMonths: wave.offsetMonths, scheduledFor: date(wave.scheduledFor), status: wave.status },
      select: { id: true },
    });
    waves.set(wave.sequence, record);
  }

  for (const fixture of demoVentureFixtures) {
    const venture = await db.venture.upsert({
      where: { organizationId_slug: { organizationId: organization.id, slug: fixture.slug } },
      update: { name: fixture.name, kind: fixture.kind, archivedAt: fixture.status === "WITHDRAWN" ? date("2024-11-18") : null },
      create: { id: `demo-venture-${fixture.slug}`, organizationId: organization.id, slug: fixture.slug, name: fixture.name, kind: fixture.kind, archivedAt: fixture.status === "WITHDRAWN" ? date("2024-11-18") : null },
      select: { id: true },
    });
    const enrollment = await db.ventureEnrollment.upsert({
      where: { organizationId_cohortId_ventureId: { organizationId: organization.id, cohortId: cohort.id, ventureId: venture.id } },
      update: { enrolledAt: date(fixture.enrolledAt), withdrawnAt: fixture.withdrawnAt ? date(fixture.withdrawnAt) : null, status: fixture.status },
      create: { id: `demo-enrollment-${fixture.slug}`, organizationId: organization.id, cohortId: cohort.id, ventureId: venture.id, enrolledAt: date(fixture.enrolledAt), withdrawnAt: fixture.withdrawnAt ? date(fixture.withdrawnAt) : null, status: fixture.status },
      select: { id: true },
    });

    for (const observationFixture of fixture.observations) {
      const wave = waves.get(observationFixture.sequence);
      if (!wave) throw new Error(`Missing demo wave ${observationFixture.sequence}`);
      const observation = await db.ventureObservation.upsert({
        where: { id: `demo-observation-${fixture.slug}-${observationFixture.sequence}` },
        update: { organizationId: organization.id, cohortId: cohort.id, ventureEnrollmentId: enrollment.id, followUpWaveId: wave.id, status: observationFixture.status, submittedAt: observationFixture.status === "SUBMITTED" ? date(demoWaves[observationFixture.sequence].scheduledFor) : null },
        create: { id: `demo-observation-${fixture.slug}-${observationFixture.sequence}`, organizationId: organization.id, cohortId: cohort.id, ventureEnrollmentId: enrollment.id, followUpWaveId: wave.id, status: observationFixture.status, submittedAt: observationFixture.status === "SUBMITTED" ? date(demoWaves[observationFixture.sequence].scheduledFor) : null },
        select: { id: true },
      });

      if (observationFixture.values) {
        const values = observationFixture.values;
        const valueInputs: Record<string, { integerValue?: number; decimalValue?: string; textValue?: string }> = {
          team_size: { integerValue: values.team_size },
          paying_customers: { integerValue: values.paying_customers },
          monthly_revenue: { decimalValue: values.monthly_revenue },
          additional_capital: { decimalValue: values.additional_capital },
          product_stage: { textValue: values.product_stage },
        };
        for (const [key, input] of Object.entries(valueInputs)) {
          const definition = definitions.get(key);
          if (!definition) throw new Error(`Missing demo indicator ${key}`);
          await db.observationValue.upsert({
            where: { organizationId_observationId_indicatorDefinitionId: { organizationId: organization.id, observationId: observation.id, indicatorDefinitionId: definition.id } },
            update: { ...input },
            create: { id: `demo-value-${fixture.slug}-${observationFixture.sequence}-${key}`, organizationId: organization.id, observationId: observation.id, indicatorDefinitionId: definition.id, ...input },
          });
        }
      }
    }

    for (const milestone of fixture.milestones) {
      await db.milestone.upsert({
        where: { organizationId_ventureId_occurredAt_title: { organizationId: organization.id, ventureId: venture.id, occurredAt: date(milestone.occurredAt), title: milestone.title } },
        update: { type: milestone.type, description: milestone.description ?? null },
        create: { id: `demo-milestone-${fixture.slug}-${milestone.occurredAt}`, organizationId: organization.id, ventureId: venture.id, type: milestone.type, title: milestone.title, description: milestone.description ?? null, occurredAt: date(milestone.occurredAt) },
      });
    }
  }

  for (const opportunity of demoOpportunities) {
    await db.opportunity.upsert({
      where: { organizationId_callNumber: { organizationId: organization.id, callNumber: opportunity.callNumber } },
      update: { institution: opportunity.institution, title: opportunity.title, objective: opportunity.objective, territory: opportunity.territory, audience: opportunity.audience, status: opportunity.status, publishedAt: date(opportunity.publishedAt), applicationEndsAt: opportunity.applicationEndsAt ? date(opportunity.applicationEndsAt) : null, sourceUrl: opportunity.sourceUrl, sourceCheckedAt },
      create: { id: `demo-opportunity-${opportunity.callNumber.replace("/", "-")}`, organizationId: organization.id, institution: opportunity.institution, callNumber: opportunity.callNumber, title: opportunity.title, objective: opportunity.objective, territory: opportunity.territory, audience: opportunity.audience, status: opportunity.status, publishedAt: date(opportunity.publishedAt), applicationEndsAt: opportunity.applicationEndsAt ? date(opportunity.applicationEndsAt) : null, sourceUrl: opportunity.sourceUrl, sourceCheckedAt },
    });
  }

  console.log(`Demo seed ready: ${organization.id}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await db.$disconnect();
});
