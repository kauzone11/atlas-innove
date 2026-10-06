import { PageHeader, Panel } from "@/components/ui";
import { ParticipantRecordForm } from "@/components/personal/record-form";
import { ParticipantRecordList, ParticipantEmpty } from "@/components/personal/record-list";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { listTeams } from "@/lib/participants/service";

export default async function PersonalTeams() {
  const { user } = await requireAuthenticatedSession(); const teams = await listTeams(user.id);
  return <div className="space-y-6"><PageHeader title="Equipes" description="Pessoas que constroem iniciativas com você, em diferentes programas e instituições." action={<ParticipantRecordForm kind="team" />} /><Panel>{teams.length ? <ParticipantRecordList kind="teams" records={teams} /> : <ParticipantEmpty title="Comece com as pessoas" description="Crie uma equipe para organizar pessoas em torno de um projeto. Depois, convide cada pessoa com um link seguro." />}</Panel></div>;
}
