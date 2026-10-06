"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Globe2, ShieldCheck } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { personalRequest } from "@/components/personal/record-form";
import type { ProjectDto } from "@/lib/participants/service";

export const projectVisibilityLabels = { PUBLIC: "Público", PLATFORM: "Pessoas na plataforma", TEAM: "Colaboradores", PRIVATE: "Privado" };

export function ProjectPublication({ project }: { project: ProjectDto }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [visibility, setVisibility] = useState(project.visibility);
  const [directoryEnabled, setDirectoryEnabled] = useState(project.directoryEnabled);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const networkVisible = visibility === "PUBLIC" || visibility === "PLATFORM";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setPending(true); setError(null);
    try {
      await personalRequest(`/api/personal/projects/${project.id}/publication`, "PATCH", {
        visibility, ...(data.get("slug") ? { publicSlug: data.get("slug") } : {}), confirmed: data.get("confirmed") === "on",
        directoryEnabled: networkVisible && directoryEnabled, collaborationOpen: networkVisible && directoryEnabled && data.get("collaborationOpen") === "on",
        collaborationNote: String(data.get("collaborationNote") ?? "").trim() || null,
      });
      setOpen(false); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível alterar a visibilidade."); }
    finally { setPending(false); }
  }
  return <section className="border-y border-line py-5" aria-labelledby="project-visibility-title">
    <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h2 id="project-visibility-title" className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={17} aria-hidden="true" />Visibilidade · {projectVisibilityLabels[project.visibility]}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate">A publicação compartilha a identidade, os temas, os links e as participações selecionadas deste projeto. A equipe e as candidaturas privadas permanecem protegidas.</p><p className="mt-2 text-sm text-slate">{project.directoryEnabled ? "O projeto aparece na descoberta da Rede." : "O projeto não aparece na descoberta da Rede."} {project.collaborationOpen ? "Aberto a novas colaborações." : "Não está buscando colaboradores agora."}</p>{project.collaborationNote ? <p className="mt-2 max-w-2xl whitespace-pre-line break-words text-sm leading-6 text-slate">{project.collaborationNote}</p> : null}</div>{project.canPublish ? <button className="button-secondary" onClick={() => { setVisibility(project.visibility); setDirectoryEnabled(project.directoryEnabled); setError(null); setOpen(true); }}>Visibilidade e descoberta</button> : null}</div>
    {project.visibility === "PUBLIC" && project.publicSlug && project.publishedAt ? <Link href={`/projects/${project.publicSlug}`} className="button-tertiary mt-2"><Globe2 size={16} aria-hidden="true" />Visualizar projeto público</Link> : null}
    <Dialog open={open} title="Visibilidade e descoberta" description="Somente proprietários podem controlar a exposição pública e a descoberta deste projeto." onClose={() => { if (!pending) setOpen(false); }}>
      <form onSubmit={submit} className="space-y-4"><fieldset disabled={pending} className="min-w-0 space-y-4">
        <label className="block space-y-2 text-sm font-medium"><span>Quem pode visualizar</span><select className="field-control" value={visibility} onChange={(event) => { const next = event.target.value as ProjectDto["visibility"]; setVisibility(next); if (next === "PRIVATE" || next === "TEAM") setDirectoryEnabled(false); }}>{Object.entries(projectVisibilityLabels).map(([value, label]) => <option value={value} key={value} disabled={value === "PUBLIC" && Boolean(project.archivedAt)}>{label}</option>)}</select></label>
        <p className="text-xs leading-5 text-slate">Pessoas na plataforma e colaboradores são escopos de compartilhamento. O espaço de trabalho e suas alterações continuam exigindo participação no projeto.</p>
        {visibility === "PUBLIC" ? <><label className="block space-y-2 text-sm font-medium"><span>Endereço público</span><input name="slug" className="field-control" required minLength={3} maxLength={64} pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={project.publicSlug ?? ""} placeholder="nome-do-projeto" /><span className="block break-all text-xs font-normal text-slate">/projects/{project.publicSlug ?? "seu-endereco"}</span></label><label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" name="confirmed" required className="mt-1 h-5 w-5 shrink-0" /><span>Confirmo a publicação. Qualquer pessoa com o link poderá visualizar essas informações.</span></label></> : <p className="text-sm leading-6 text-slate">O acesso público será removido. Os dados, a história e as candidaturas do projeto serão preservados.</p>}
        <div className="space-y-3 border-t border-line pt-4"><h3 className="font-semibold">Descoberta e colaboração</h3><label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" checked={directoryEnabled} onChange={(event) => setDirectoryEnabled(event.target.checked)} disabled={!networkVisible || Boolean(project.archivedAt)} className="mt-1 h-5 w-5 shrink-0" /><span>Permitir que pessoas na plataforma descubram este projeto.</span></label><p className="text-xs leading-5 text-slate">A descoberta exige visibilidade para pessoas na plataforma ou público. Ela compartilha somente a apresentação do projeto, seus temas e links; tarefas, recursos e candidaturas ficam no espaço de trabalho.</p><label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" name="collaborationOpen" defaultChecked={project.collaborationOpen} disabled={!directoryEnabled || !networkVisible} className="mt-1 h-5 w-5 shrink-0" /><span>Receber solicitações de colaboração.</span></label><label className="block space-y-2 text-sm font-medium"><span>Que colaboração o projeto procura?</span><textarea className="field-control" name="collaborationNote" defaultValue={project.collaborationNote ?? ""} maxLength={500} rows={3} /><span className="block text-xs font-normal text-slate">Opcional, até 500 caracteres.</span></label></div>
      </fieldset>{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}<button className="button-primary w-full" disabled={pending}>{pending ? "Salvando…" : "Salvar visibilidade e descoberta"}</button></form>
    </Dialog>
  </section>;
}
