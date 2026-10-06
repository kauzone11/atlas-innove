import Link from "next/link";
import { PersonalApplicationList } from "@/components/personal/applications";
import { Panel, PanelHeader } from "@/components/ui";
import type { PersonalApplicationDto } from "@/lib/selection/service";
import { formatMonitoringDate } from "@/lib/monitoring/format";

type ProgramAward = { id: string; applicationId: string; status: string; startsAt: string | null; endsAt: string | null };
const awardLabels: Record<string, string> = { PREPARING: "Apoio em preparação", ACTIVE: "Em execução", SUSPENDED: "Execução suspensa", COMPLETED: "Execução concluída", TERMINATED: "Execução encerrada antecipadamente", CANCELLED: "Apoio cancelado" };

export function groupPersonalPrograms(applications: PersonalApplicationDto[]) {
  const groups = new Map<string, { id: string; name: string; institution: string; applications: PersonalApplicationDto[] }>();
  for (const application of applications) {
    const program = application.fundingCall.fundingProgram;
    const institution = application.fundingCall.organization;
    const key = `${institution.id}:${program.id}`;
    const group = groups.get(key) ?? { id: key, name: program.name, institution: institution.name, applications: [] };
    group.applications.push(application); groups.set(key, group);
  }
  return [...groups.values()];
}

export function PersonalPrograms({ applications, awards = [], limit }: { applications: PersonalApplicationDto[]; awards?: ProgramAward[]; limit?: number }) {
  const groups = groupPersonalPrograms(applications);
  return <div className="space-y-5">{groups.slice(0, limit).map((group) => <Panel key={group.id}><PanelHeader title={group.name} description={group.institution} /><PersonalApplicationList applications={group.applications} />{group.applications.some((application) => awards.some((award) => award.applicationId === application.id) || application.enrollment) ? <ul className="divide-y divide-line border-t border-line px-4 sm:px-6">{group.applications.map((application) => {
    const award = awards.find((item) => item.applicationId === application.id);
    if (!award && !application.enrollment) return null;
    return <li key={application.id} className="py-4"><p className="break-words text-sm font-medium">{application.projectNameSnapshot}</p>{award ? <><Link href={`/app/personal/awards/${award.id}`} className="inline-flex min-h-11 items-center text-sm font-medium text-accent-hover">{awardLabels[award.status] ?? "Consultar execução do apoio"}</Link><p className="text-xs text-slate">{formatMonitoringDate(award.startsAt)} → {formatMonitoringDate(award.endsAt)}</p></> : null}{application.enrollment ? <p className="mt-2 text-xs text-slate">Acompanhamento longitudinal · {application.enrollment.cohort.name} · <Link className="inline-flex min-h-11 items-center text-accent-hover" href={`/app/personal/applications/${application.id}`}>Consultar participação</Link></p> : null}</li>;
  })}</ul> : null}</Panel>)}{limit && groups.length > limit ? <Link className="button-tertiary" href="/app/personal/programs">Ver todos os programas</Link> : null}</div>;
}
