import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { ParticipantEmpty } from "@/components/personal/record-list";
import { CreateDiscussion } from "@/components/communication/discussion-actions";
import { RefreshCommunication } from "@/components/communication/actions";
import { requireAuthenticatedSession } from "@/lib/auth/session";
import { listProjectDiscussions } from "@/lib/communication/discussions";
import { communicationDate } from "@/lib/communication/presentation";
import { ResourceNotFoundError } from "@/lib/errors";

export default async function DiscussionsPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ page?: string }> }) {
  const { user } = await requireAuthenticatedSession(); const { projectId } = await params; const query = await searchParams;
  const result = await listProjectDiscussions(user.id, projectId, query.page).catch((error: unknown) => { if (error instanceof ResourceNotFoundError) notFound(); throw error; });
  const href = `/app/personal/projects/${projectId}/discussions`;
  return <div className="min-w-0 space-y-6"><PageHeader title="Discussões" description="Decisões e conversas entre os colaboradores atuais deste projeto." breadcrumbs={<Breadcrumbs items={[{ label: "Projetos", href: "/app/personal/projects" }, { label: result.project.name, href: `/app/personal/projects/${projectId}` }, { label: "Discussões" }]} />} action={<div className="flex flex-wrap gap-2"><RefreshCommunication />{result.canCreate ? <CreateDiscussion projectId={projectId} /> : null}</div>} /><Panel>{result.discussions.length ? <ul className="divide-y divide-line">{result.discussions.map((discussion) => <li key={discussion.id}><Link className="flex min-h-20 flex-wrap items-start justify-between gap-3 p-4 sm:p-5" href={`${href}/${discussion.id}`}><div className="min-w-0 flex-1"><h2 className="break-words font-semibold">{discussion.title}</h2><p className="mt-2 break-words text-xs leading-6 text-slate">{discussion.createdByName} · Última atividade em {communicationDate(discussion.updatedAt)} · {discussion.replyCount} {discussion.replyCount === 1 ? "resposta" : "respostas"}</p></div><StatusBadge label={discussion.status === "OPEN" ? "Aberta" : "Encerrada"} tone={discussion.status === "OPEN" ? "success" : "neutral"} /></Link></li>)}</ul> : <ParticipantEmpty title="Nenhuma discussão aberta" description="Crie uma discussão para registrar uma decisão, alinhar uma etapa ou compartilhar uma questão com os colaboradores." />}</Panel><nav className="flex flex-wrap gap-3" aria-label="Páginas de discussões">{result.page > 1 ? <Link className="button-secondary" href={`${href}?page=${result.page - 1}`}>Página anterior</Link> : null}{result.page * result.pageSize < result.total ? <Link className="button-secondary" href={`${href}?page=${result.page + 1}`}>Próxima página</Link> : null}</nav><Link className="button-secondary" href={`/app/personal/projects/${projectId}`}>Voltar ao projeto</Link></div>;
}
