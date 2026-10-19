import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader, Panel, PanelHeader } from "@/components/ui";
import { PeopleDiscoveryList, ProjectDiscoveryList } from "@/components/network/discovery-list";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { listDiscoverablePeople } from "@/lib/network/people";
import { listDiscoverableProjects } from "@/lib/network/projects";

export default async function NetworkHome() {
  const { user } = await requireAuthenticatedSession();
  const [people, projects, profile, pending] = await Promise.all([
    listDiscoverablePeople(user.id, { pageSize: 6 }), listDiscoverableProjects(user.id, { pageSize: 6 }),
    db.innovationProfile.findUnique({ where: { userId: user.id }, select: { directoryEnabled: true } }),
    db.connectionRequest.count({ where: { recipientUserId: user.id, status: "PENDING" } }),
  ]);
  return <div className="space-y-7">
    <PageHeader title="Rede" description="Encontre pessoas e projetos para colaborar em inovação." />
    <nav aria-label="Áreas da rede" className="flex flex-wrap gap-2"><Link className="chip" href="/app/personal/network/people">Pessoas</Link><Link className="chip" href="/app/personal/network/projects">Projetos</Link><Link className="chip" href="/app/personal/network/institutions">Instituições</Link><Link className="chip" href="/app/personal/network/connections">Conexões</Link><Link className="chip" href="/app/personal/network/requests">Solicitações{pending ? ` (${pending})` : ""}</Link></nav>
    {!profile?.directoryEnabled ? <div className="callout callout-brand"><p className="text-sm font-medium">Seu perfil ainda não aparece na Rede.</p><p className="mt-1 text-sm text-slate">Ser encontrado é uma escolha separada da visibilidade pública do perfil.</p><Link className="button-tertiary mt-2" href="/app/personal/profile/edit">Configurar descoberta <ArrowRight size={16} aria-hidden="true" /></Link></div> : null}
    {pending ? <p className="text-sm"><Link className="button-tertiary" href="/app/personal/network/requests">Você recebeu {pending} {pending === 1 ? "solicitação de conexão" : "solicitações de conexão"}. Revisar solicitações.</Link></p> : null}
    <Panel><PanelHeader title="Pessoas para conhecer" description="A afinidade considera apenas temas e informações visíveis na plataforma." action={<Link href="/app/personal/network/people" className="button-tertiary">Explorar pessoas</Link>} /><div className="px-4 pb-4 sm:px-5"><PeopleDiscoveryList viewerUserId={user.id} people={people.people} /></div></Panel>
    <Panel><PanelHeader title="Projetos na rede" description="Iniciativas que escolheram participar da descoberta." action={<Link href="/app/personal/network/projects" className="button-tertiary">Explorar projetos</Link>} /><div className="px-4 pb-4 sm:px-5"><ProjectDiscoveryList projects={projects.projects} /></div></Panel>
    <p className="text-sm leading-6 text-slate">Uma conexão permite iniciar conversas diretas. Ela não libera informações marcadas como privadas.</p>
  </div>;
}
