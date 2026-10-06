import Link from "next/link";
import { PageHeader, Panel } from "@/components/ui";
import { PersonalApplicationList } from "@/components/personal/applications";
import { ParticipantEmpty } from "@/components/personal/record-list";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { listPersonalApplications } from "@/lib/selection/service";

export default async function PersonalApplications() {
  const { user } = await requireAuthenticatedSession(); const applications = await listPersonalApplications(user.id);
  return <div className="space-y-6"><PageHeader title="Candidaturas" description="A participação de seus projetos em cada edital, do rascunho ao resultado publicado." action={<Link className="button-secondary" href="/app/personal/opportunities">Explorar oportunidades</Link>} /><Panel>{applications.length ? <PersonalApplicationList applications={applications} /> : <ParticipantEmpty title="Você ainda não iniciou candidaturas" description="Encontre um edital aberto, escolha um projeto e prepare sua participação." />}</Panel></div>;
}
