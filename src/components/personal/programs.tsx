import Link from "next/link";
import { PersonalApplicationList } from "@/components/personal/applications";
import { Panel, PanelHeader } from "@/components/ui";
import type { PersonalApplicationDto } from "@/lib/selection/service";

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

export function PersonalPrograms({ applications, limit }: { applications: PersonalApplicationDto[]; limit?: number }) {
  const groups = groupPersonalPrograms(applications);
  return <div className="space-y-5">{groups.slice(0, limit).map((group) => <Panel key={group.id}><PanelHeader title={group.name} description={group.institution} /><PersonalApplicationList applications={group.applications} /></Panel>)}{limit && groups.length > limit ? <Link className="button-tertiary" href="/app/personal/programs">Ver todos os programas</Link> : null}</div>;
}
