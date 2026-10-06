import Link from "next/link";
import { PageHeader, Panel } from "@/components/ui";
import { PersonalPrograms } from "@/components/personal/programs";
import { ParticipantEmpty } from "@/components/personal/record-list";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { listPersonalApplications } from "@/lib/selection/service";

export default async function PersonalProgramsPage() {
  const { user } = await requireAuthenticatedSession();
  const applications = await listPersonalApplications(user.id);
  return <div className="space-y-6"><PageHeader title="Meus programas" description="Sua participação em programas de inovação, das candidaturas ao acompanhamento." action={<Link className="button-secondary" href="/app/personal/opportunities">Explorar oportunidades</Link>} />{applications.length ? <PersonalPrograms applications={applications} /> : <Panel><ParticipantEmpty title="Um programa pode fazer parte da sua próxima etapa" description="Explore oportunidades e prepare uma candidatura com seu projeto. Aqui você acompanhará os envios e resultados de cada programa." action={<Link className="button-primary" href="/app/personal/opportunities">Explorar oportunidades</Link>} /></Panel>}<Link className="button-tertiary" href="/app/personal/applications">Consultar todas as candidaturas</Link></div>;
}
