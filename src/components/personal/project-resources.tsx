"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Link2, Pencil, Plus } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { Panel, PanelHeader } from "@/components/ui";
import { ParticipantEmpty } from "@/components/personal/record-list";
import { personalRequest } from "@/components/personal/record-form";
import { formatMonitoringDate } from "@/lib/monitoring/format";
import type { ProjectCollaborationDto, ProjectResourceDto } from "@/lib/project-collaboration/service";
import { resourceTypeLabels } from "@/lib/project-collaboration/state";

function ResourceEditor({ projectId, resource }: { projectId: string; resource?: ProjectResourceDto }) {
  const router = useRouter(); const [open, setOpen] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setPending(true); setError(null);
    try { await personalRequest(`/api/personal/projects/${projectId}/resources${resource ? `/${resource.id}` : ""}`, resource ? "PATCH" : "POST", {
      label: data.get("label"), type: data.get("type"), url: data.get("url"), description: data.get("description") || null,
      ...(resource ? { expectedRevision: resource.revision } : {}),
    }); setOpen(false); router.refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Não foi possível salvar o recurso."); }
    finally { setPending(false); }
  }
  return <><button className="button-secondary" type="button" onClick={() => { setError(null); setOpen(true); }}>{resource ? <Pencil size={15} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}{resource ? "Editar" : "Adicionar recurso"}</button><Dialog open={open} onClose={() => { if (!pending) setOpen(false); }} title={resource ? "Editar recurso" : "Adicionar recurso"} description="Links privados para materiais usados pelos colaboradores do projeto."><form onSubmit={submit} className="space-y-4"><label className="block space-y-2 text-sm font-medium"><span>Nome</span><input className="field-control" name="label" defaultValue={resource?.label} required minLength={2} maxLength={180} /></label><label className="block space-y-2 text-sm font-medium"><span>Tipo</span><select className="field-control" name="type" defaultValue={resource?.type ?? "DOCUMENT"}>{Object.entries(resourceTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="block space-y-2 text-sm font-medium"><span>Link HTTPS</span><input className="field-control" name="url" type="url" pattern="https://.*" placeholder="https://" defaultValue={resource?.url} required maxLength={2000} /></label><label className="block space-y-2 text-sm font-medium"><span>Descrição (opcional)</span><textarea className="field-control" name="description" defaultValue={resource?.description ?? ""} rows={3} maxLength={4000} /></label>{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}<button className="button-primary w-full" disabled={pending}>{pending ? "Salvando…" : "Salvar recurso"}</button></form></Dialog></>;
}
function RemoveResource({ resource }: { resource: ProjectResourceDto }) {
  const router = useRouter(); const [open, setOpen] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  async function remove() { setPending(true); setError(null); try { await personalRequest(`/api/personal/projects/${resource.projectId}/resources/${resource.id}`, "DELETE", { expectedRevision: resource.revision }); setOpen(false); router.refresh(); } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível remover o recurso."); } finally { setPending(false); } }
  return <><button type="button" className="button-tertiary" onClick={() => setOpen(true)}>Remover</button><Dialog open={open} onClose={() => { if (!pending) setOpen(false); }} title="Remover recurso" description={`O link “${resource.label}” deixará de aparecer neste projeto. O material no site de origem permanece disponível.`}>{error ? <p role="alert" className="mb-3 text-sm text-danger">{error}</p> : null}<div className="flex flex-wrap gap-3"><button className="button-secondary" disabled={pending} onClick={() => setOpen(false)}>Manter recurso</button><button className="button-primary" disabled={pending} onClick={() => void remove()}>{pending ? "Removendo…" : "Confirmar remoção"}</button></div></Dialog></>;
}
export function ProjectResources({ projectId, workspace }: { projectId: string; workspace: ProjectCollaborationDto }) {
  return <Panel><PanelHeader title="Recursos" description="Documentos e materiais privados da equipe. A publicação do projeto mantém seus próprios links." action={workspace.canManage && workspace.resources.length < 100 ? <ResourceEditor projectId={projectId} /> : undefined} />{workspace.resources.length ? <ul className="divide-y divide-line">{workspace.resources.map((resource) => <li key={resource.id} className="px-5 py-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><h3 className="flex items-start gap-2 font-medium"><Link2 size={17} className="mt-0.5 shrink-0 text-slate" aria-hidden="true" /><span className="min-w-0 break-words">{resource.label}</span></h3><p className="mt-2 break-words text-xs leading-5 text-slate">{resourceTypeLabels[resource.type]} · {resource.host} · Adicionado em {formatMonitoringDate(resource.createdAt)} por {resource.createdByName}</p>{resource.description ? <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate">{resource.description}</p> : null}</div><a href={resource.url} target="_blank" rel="noopener noreferrer" className="button-secondary" aria-label={`Abrir ${resource.label} em nova aba`}>Abrir<ExternalLink size={15} aria-hidden="true" /></a></div>{resource.canManage ? <div className="mt-3 flex flex-wrap gap-2"><ResourceEditor projectId={projectId} resource={resource} /><RemoveResource resource={resource} /></div> : null}</li>)}</ul> : <ParticipantEmpty title="Nenhum recurso registrado" description="Adicione links para documentos, repositórios ou materiais usados pela equipe." />}</Panel>;
}
