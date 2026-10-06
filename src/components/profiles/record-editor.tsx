"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { personalRequest } from "@/components/personal/record-form";
import { ProfileField, VisibilityControl } from "@/components/profiles/section-editor";
import type { OwnProfile } from "@/lib/profiles/service";
import type { ProfileRecordKind } from "@/lib/profiles/schemas";

type Experience = OwnProfile["experience"][number];
type Education = OwnProfile["education"][number];
type ProfileLink = OwnProfile["links"][number];
type RecordValue = Experience | Education | ProfileLink;
const labels: Record<ProfileRecordKind, string> = { experience: "experiência", education: "formação", links: "link" };

export function ProfileRecordEditor({ kind, record }: { kind: ProfileRecordKind; record?: RecordValue }) {
  const router = useRouter(); const [open, setOpen] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  const experience = kind === "experience" ? record as Experience | undefined : undefined;
  const education = kind === "education" ? record as Education | undefined : undefined;
  const link = kind === "links" ? record as ProfileLink | undefined : undefined;
  const [current, setCurrent] = useState(experience?.current ?? false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const text = (name: string) => String(form.get(name) ?? "").trim() || null;
    const data = kind === "experience" ? { organizationName: text("organizationName"), title: text("title"), startsAt: text("startsAt"), endsAt: current ? null : text("endsAt"), current, description: text("description"), visibility: form.get("visibility") }
      : kind === "education" ? { institution: text("institution"), course: text("course"), degree: text("degree"), startsAt: text("startsAt"), endsAt: text("endsAt"), description: text("description"), visibility: form.get("visibility") }
        : { label: text("label"), url: text("url"), type: form.get("type"), visibility: form.get("visibility") };
    setPending(true); setError(null);
    try { await personalRequest(`/api/personal/profile/records/${kind}${record ? `/${record.id}` : ""}`, record ? "PATCH" : "POST", data); setOpen(false); router.refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Não foi possível salvar este registro."); }
    finally { setPending(false); }
  }
  return <><button className="button-secondary" type="button" onClick={() => { setError(null); setCurrent(experience?.current ?? false); setOpen(true); }}>{record ? <Pencil size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}{record ? <><span className="sr-only">{labels[kind]}: </span>Editar</> : `Adicionar ${labels[kind]}`}</button>
    <Dialog open={open} onClose={() => { if (!pending) setOpen(false); }} title={`${record ? "Editar" : "Adicionar"} ${labels[kind]}`} description="Informações declaradas por você. A visibilidade da seção também precisa permitir a exibição deste registro.">
      <form onSubmit={submit} className="space-y-4"><fieldset disabled={pending} className="min-w-0 space-y-4">
        {kind === "experience" ? <><ProfileField label="Organização"><input className="field-control" name="organizationName" required minLength={2} maxLength={160} defaultValue={experience?.organizationName} /></ProfileField><ProfileField label="Atuação ou cargo"><input className="field-control" name="title" required minLength={2} maxLength={160} defaultValue={experience?.title} /></ProfileField><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={current} onChange={(event) => setCurrent(event.target.checked)} />Atuação atual</label></> : null}
        {kind === "education" ? <><ProfileField label="Instituição de ensino"><input className="field-control" name="institution" required minLength={2} maxLength={160} defaultValue={education?.institution} /></ProfileField><ProfileField label="Curso"><input className="field-control" name="course" required minLength={2} maxLength={160} defaultValue={education?.course} /></ProfileField><ProfileField label="Titulação (opcional)"><input className="field-control" name="degree" maxLength={120} defaultValue={education?.degree ?? ""} /></ProfileField></> : null}
        {kind !== "links" ? <><div className="grid gap-4 sm:grid-cols-2"><ProfileField label={kind === "experience" ? "Data inicial" : "Data inicial (opcional)"}><input className="field-control" type="date" name="startsAt" required={kind === "experience"} min="1900-01-01" max="2200-12-31" defaultValue={experience?.startsAt ?? education?.startsAt ?? ""} /></ProfileField><ProfileField label="Data final (opcional)"><input className="field-control" type="date" name="endsAt" min="1900-01-01" max="2200-12-31" disabled={kind === "experience" && current} defaultValue={experience?.endsAt ?? education?.endsAt ?? ""} /></ProfileField></div><ProfileField label="Descrição (opcional)"><textarea className="field-control" name="description" rows={4} maxLength={2400} defaultValue={experience?.description ?? education?.description ?? ""} /></ProfileField></> : null}
        {kind === "links" ? <><ProfileField label="Nome do link"><input className="field-control" name="label" required minLength={2} maxLength={120} defaultValue={link?.label} /></ProfileField><ProfileField label="Endereço" help="Use HTTPS. O link será aberto em uma nova aba."><input className="field-control" type="url" name="url" required maxLength={2000} defaultValue={link?.url} placeholder="https://" /></ProfileField><ProfileField label="Tipo"><select className="field-control" name="type" defaultValue={link?.type ?? "WEBSITE"}><option value="WEBSITE">Site</option><option value="LINKEDIN">LinkedIn</option><option value="GITHUB">GitHub</option><option value="ORCID">ORCID</option><option value="PORTFOLIO">Portfólio</option><option value="OTHER">Outro</option></select></ProfileField></> : null}
        <VisibilityControl value={record?.visibility ?? "PRIVATE"} />
      </fieldset>{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}<button className="button-primary w-full" disabled={pending}>{pending ? "Salvando…" : "Salvar registro"}</button></form>
    </Dialog></>;
}

export function RemoveProfileRecord({ kind, recordId }: { kind: ProfileRecordKind; recordId: string }) {
  const router = useRouter(); const [open, setOpen] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  async function remove() { setPending(true); setError(null); try { await personalRequest(`/api/personal/profile/records/${kind}/${recordId}`, "DELETE"); setOpen(false); router.refresh(); } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível remover o registro."); } finally { setPending(false); } }
  return <><button className="button-secondary px-3" type="button" aria-label={`Remover ${labels[kind]}`} onClick={() => { setError(null); setOpen(true); }}><Trash2 size={15} aria-hidden="true" /></button><Dialog open={open} title={`Remover ${labels[kind]}`} description="Este registro será removido do seu perfil. Essa ação não altera participações verificadas nem o histórico institucional." onClose={() => { if (!pending) setOpen(false); }}>{error ? <p role="alert" className="mb-4 text-sm text-danger">{error}</p> : null}<div className="flex flex-wrap gap-3"><button className="button-secondary" disabled={pending} onClick={() => setOpen(false)}>Cancelar</button><button className="button-danger" disabled={pending} onClick={remove}>{pending ? "Removendo…" : "Confirmar remoção"}</button></div></Dialog></>;
}
