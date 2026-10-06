"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { Dialog } from "@/components/dialog";
import type { TeamDto, ProjectDto } from "@/lib/participants/service";

export async function personalRequest(url: string, method: string, input?: unknown) {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, ...(input === undefined ? {} : { body: JSON.stringify(input) }) }).catch(() => {
    throw new Error("Não foi possível conectar ao Atlas Innove. Verifique sua conexão e tente novamente.");
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(Object.values(payload.issues ?? {}).flat().join(" ") || payload.error || "Não foi possível concluir a operação.");
  return payload;
}

export function ParticipantRecordForm({ kind, record, teams = [], initialTeamId }: { kind: "team" | "project"; record?: TeamDto | ProjectDto; teams?: TeamDto[]; initialTeamId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const project = kind === "project" ? record as ProjectDto | undefined : undefined;
  const label = kind === "team" ? "equipe" : "projeto";
  const canChangeTeam = !record || Boolean(project?.canChangeTeam);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true); setError(null);
    try {
      const chosenTeamId = data.get("primaryTeamId") || null;
      const input = { name: data.get("name"), description: data.get("description") || null, ...(kind === "project" ? { summary: data.get("summary"), status: data.get("status"), thematicAreas: String(data.get("thematicAreas") ?? "").split(",").map((value) => value.trim()).filter(Boolean), websiteUrl: data.get("websiteUrl") || null, repositoryUrl: data.get("repositoryUrl") || null, demoUrl: data.get("demoUrl") || null, ...(canChangeTeam && (!project || chosenTeamId !== project.primaryTeamId) ? { primaryTeamId: chosenTeamId } : {}) } : {}) };
      const payload = await personalRequest(`/api/personal/${kind === "team" ? "teams" : "projects"}${record ? `/${record.id}` : ""}`, record ? "PATCH" : "POST", input);
      setOpen(false);
      if (!record) router.push(`/app/personal/${kind === "team" ? "teams" : "projects"}/${payload[kind].id}`);
      else router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setPending(false); }
  }
  return <><button className={record ? "button-secondary" : "button-primary"} onClick={() => { setError(null); setOpen(true); }}>{record ? <Pencil size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}{record ? `Editar ${label}` : `Criar ${label}`}</button><Dialog open={open} title={`${record ? "Editar" : "Criar"} ${label}`} description={kind === "team" ? "Organize pessoas em torno de projetos. A equipe pode participar de diferentes programas." : "Uma identidade contínua para sua iniciativa, independente dos editais."} onClose={() => { if (!pending) setOpen(false); }}><form onSubmit={submit} className="space-y-4"><label className="block space-y-2 text-sm font-medium"><span>Nome</span><input className="field-control" name="name" defaultValue={record?.name} required minLength={2} maxLength={160} /></label>{kind === "project" ? <><label className="block space-y-2 text-sm font-medium"><span>Resumo do projeto</span><textarea className="field-control" name="summary" defaultValue={project?.summary} required minLength={10} maxLength={2000} rows={3} /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-2 text-sm font-medium"><span>Etapa</span><select className="field-control" name="status" defaultValue={project?.status ?? "IDEA"}><option value="IDEA">Ideia</option><option value="ACTIVE">Em desenvolvimento</option><option value="PAUSED">Pausado</option><option value="COMPLETED">Concluído</option></select></label>{canChangeTeam ? <label className="block space-y-2 text-sm font-medium"><span>Equipe principal (opcional)</span><select className="field-control" name="primaryTeamId" defaultValue={project?.primaryTeamId ?? initialTeamId ?? ""}><option value="">Projeto independente</option>{project?.primaryTeamId && !teams.some((team) => team.id === project.primaryTeamId && !team.archivedAt && team.canManage) ? <option value={project.primaryTeamId}>{project.teamName} (vínculo atual)</option> : null}{teams.filter((team) => !team.archivedAt && team.canManage).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label> : null}</div></> : null}<label className="block space-y-2 text-sm font-medium"><span>Descrição (opcional)</span><textarea className="field-control" name="description" defaultValue={record?.description ?? ""} maxLength={kind === "team" ? 4000 : 12000} rows={4} /></label>{kind === "project" ? <details className="border-t border-line pt-4"><summary className="min-h-11 cursor-pointer text-sm font-medium">Temas e links do projeto</summary><div className="mt-3 space-y-4"><label className="block space-y-2 text-sm font-medium"><span>Áreas temáticas</span><input className="field-control" name="thematicAreas" defaultValue={project?.thematicAreas.join(", ") ?? ""} maxLength={1600} /><span className="block text-xs font-normal text-slate">Separe por vírgulas. Estes temas ajudam a explorar oportunidades compatíveis.</span></label>{[["websiteUrl", "Site", project?.websiteUrl], ["repositoryUrl", "Repositório", project?.repositoryUrl], ["demoUrl", "Demonstração", project?.demoUrl]].map(([name, label, url]) => <label className="block space-y-2 text-sm font-medium" key={name}><span>{label} (opcional)</span><input className="field-control" name={name ?? ""} defaultValue={url ?? ""} type="url" pattern="https://.*" maxLength={2048} placeholder="https://" /></label>)}</div></details> : null}{project?.primaryTeamId && canChangeTeam ? <p className="text-xs leading-5 text-slate">Mudar a equipe altera o acesso derivado de seus membros. Participações explícitas no projeto e candidaturas anteriores são preservadas.</p> : null}{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}<button className="button-primary w-full" disabled={pending}>{pending ? "Salvando…" : record ? "Salvar alterações" : `Criar ${label}`}</button></form></Dialog></>;
}

export function ArchiveParticipantRecord({ kind, id }: { kind: "teams" | "projects"; id: string }) {
  const router = useRouter(); const [open, setOpen] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  async function archive() { setPending(true); setError(null); try { await personalRequest(`/api/personal/${kind}/${id}`, "PATCH", kind === "teams" ? { archived: true } : { status: "ARCHIVED" }); setOpen(false); router.refresh(); } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível arquivar."); } finally { setPending(false); } }
  return <><button className="button-secondary" onClick={() => setOpen(true)}>Arquivar</button><Dialog open={open} onClose={() => { if (!pending) setOpen(false); }} title={kind === "teams" ? "Arquivar equipe" : "Arquivar projeto"} description="O histórico de membros, projetos e candidaturas será preservado. O arquivamento é definitivo e impede novas alterações e envios.">{error ? <p role="alert" className="mb-4 text-sm text-danger">{error}</p> : null}<div className="flex flex-wrap gap-3"><button className="button-secondary" disabled={pending} onClick={() => setOpen(false)}>Cancelar</button><button className="button-primary" disabled={pending} onClick={archive}>{pending ? "Arquivando…" : "Confirmar arquivamento"}</button></div></Dialog></>;
}
