import { PageHeader, Panel } from "@/components/ui";
import { ParticipantRecordForm } from "@/components/personal/record-form";
import { ParticipantRecordList, ParticipantEmpty } from "@/components/personal/record-list";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { listTeams, listProjects } from "@/lib/participants/service";

export default async function PersonalProjects() {
  const { user } = await requireAuthenticatedSession(); const [teams, projects] = await Promise.all([listTeams(user.id), listProjects(user.id)]);
  return <div className="space-y-6"><PageHeader title="Projetos" description="Suas iniciativas mantêm a mesma identidade ao participar de diferentes editais." action={<ParticipantRecordForm kind="project" teams={teams} />} /><Panel>{projects.length ? <ParticipantRecordList kind="projects" records={projects} /> : <ParticipantEmpty title="Dê forma à sua iniciativa" description="Crie um projeto ou comece a partir de uma equipe. Um resumo claro ajuda a preparar suas primeiras candidaturas." />}</Panel></div>;
}
