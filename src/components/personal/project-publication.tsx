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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setPending(true); setError(null);
    try {
      await personalRequest(`/api/personal/projects/${project.id}/publication`, "PATCH", { visibility, ...(data.get("slug") ? { publicSlug: data.get("slug") } : {}), confirmed: data.get("confirmed") === "on" });
      setOpen(false); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível alterar a visibilidade."); }
    finally { setPending(false); }
  }
  return <section className="border-y border-line py-5" aria-labelledby="project-visibility-title"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 id="project-visibility-title" className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={17} aria-hidden="true" />Visibilidade · {projectVisibilityLabels[project.visibility]}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate">A publicação compartilha a identidade, os temas, os links e as participações selecionadas deste projeto. A equipe e as candidaturas privadas permanecem protegidas.</p></div>{project.canPublish ? <button className="button-secondary" onClick={() => { setVisibility(project.visibility); setError(null); setOpen(true); }}>Gerenciar visibilidade</button> : null}</div>{project.visibility === "PUBLIC" && project.publicSlug && project.publishedAt ? <Link href={`/projects/${project.publicSlug}`} className="button-tertiary mt-2"><Globe2 size={16} aria-hidden="true" />Visualizar projeto público</Link> : null}<Dialog open={open} title="Visibilidade do projeto" description="Somente proprietários podem publicar ou retirar este projeto do acesso público." onClose={() => { if (!pending) setOpen(false); }}><form onSubmit={submit} className="space-y-4"><label className="block space-y-2 text-sm font-medium"><span>Quem pode visualizar</span><select className="field-control" value={visibility} onChange={(event) => setVisibility(event.target.value as ProjectDto["visibility"])}>{Object.entries(projectVisibilityLabels).map(([value, label]) => <option value={value} key={value} disabled={value === "PUBLIC" && Boolean(project.archivedAt)}>{label}</option>)}</select></label><p className="text-xs leading-5 text-slate">Pessoas na plataforma e colaboradores são escopos de compartilhamento. O espaço de trabalho e suas alterações continuam exigindo participação no projeto.</p>{visibility === "PUBLIC" ? <><label className="block space-y-2 text-sm font-medium"><span>Endereço público</span><input name="slug" className="field-control" required minLength={3} maxLength={64} pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={project.publicSlug ?? ""} placeholder="nome-do-projeto" /><span className="block break-all text-xs font-normal text-slate">/projects/{project.publicSlug ?? "seu-endereco"}</span></label><label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" name="confirmed" required className="mt-1 h-5 w-5 shrink-0" /><span>Confirmo a publicação. Qualquer pessoa com o link poderá visualizar essas informações.</span></label></> : <p className="text-sm leading-6 text-slate">O acesso público será removido. Os dados, a história e as candidaturas do projeto serão preservados.</p>}{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}<button className="button-primary w-full" disabled={pending}>{pending ? "Salvando…" : visibility === "PUBLIC" ? "Confirmar publicação" : "Salvar visibilidade"}</button></form></Dialog></section>;
}
