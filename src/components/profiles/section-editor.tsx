"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { personalRequest } from "@/components/personal/record-form";
import type { OwnProfile } from "@/lib/profiles/service";
import { privacyFields, visibilityDescriptions, visibilityLabels, type VisibilityScope } from "@/lib/profiles/visibility";
import { collaborationStatusLabels } from "@/lib/network/presentation";

export type ProfileSectionValues = Pick<OwnProfile, "handle" | "headline" | "bio" | "city" | "state" | "country" | "skills" | "interests" | "profileVisibility" | "skillsVisibility" | "experienceVisibility" | "educationVisibility" | "linksVisibility" | "verifiedParticipationVisibility" | "projectsVisibility" | "directoryEnabled" | "collaborationStatus" | "collaborationNote">;
const titles = { identity: "Identidade de inovação", about: "Sobre", topics: "Competências e interesses", privacy: "Privacidade", discovery: "Descoberta e colaboração" };
export function ProfileField({ label, children, help }: { label: string; children: ReactNode; help?: string }) {
  return <label className="block space-y-2 text-sm font-medium"><span>{label}</span>{children}{help ? <span className="block text-xs font-normal leading-5 text-slate">{help}</span> : null}</label>;
}
export function VisibilityControl({ name = "visibility", value = "PRIVATE", label = "Quem pode ver este registro" }: { name?: string; value?: VisibilityScope; label?: string }) {
  return <ProfileField label={label}><select className="field-control" name={name} defaultValue={value}>{Object.entries(visibilityLabels).map(([scope, text]) => <option key={scope} value={scope}>{text}</option>)}</select></ProfileField>;
}

export function ProfileSectionEditor({ section, values }: { section: keyof typeof titles; values: ProfileSectionValues }) {
  const router = useRouter();
  const [open, setOpen] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const text = (name: string) => String(form.get(name) ?? "").trim() || null;
    const tags = (name: string) => String(form.get(name) ?? "").split(/\r?\n/).map((tag) => tag.trim()).filter(Boolean);
    const data = section === "identity" ? { handle: text("handle"), headline: text("headline"), city: text("city"), state: text("state"), country: text("country") }
      : section === "about" ? { bio: text("bio") }
        : section === "topics" ? { skills: tags("skills"), interests: tags("interests") }
          : section === "discovery" ? { directoryEnabled: form.get("directoryEnabled") === "on", collaborationStatus: form.get("collaborationStatus"), collaborationNote: text("collaborationNote") }
          : Object.fromEntries(privacyFields.map(([name]) => [name, form.get(name)]));
    setPending(true); setError(null);
    try { await personalRequest("/api/personal/profile", "PATCH", { section, data }); setOpen(false); router.refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Não foi possível salvar esta seção."); }
    finally { setPending(false); }
  }
  return <><button type="button" className="button-secondary" onClick={() => { setError(null); setOpen(true); }}><Pencil size={15} aria-hidden="true" /><span className="sr-only">{titles[section]}: </span>Editar</button>
    <Dialog open={open} onClose={() => { if (!pending) setOpen(false); }} title={titles[section]} description={section === "privacy" ? "As seções seguem a visibilidade do perfil. Experiências, formações e links também respeitam a escolha de cada registro." : undefined}>
      <form onSubmit={submit} className="space-y-4"><fieldset disabled={pending} className="min-w-0 space-y-4">
        {section === "identity" ? <>
          <ProfileField label="Endereço do perfil" help="Letras, números e hífens. Alterar este endereço desativa o link anterior."><div className="flex min-w-0 items-center rounded-lg border border-line bg-surface-subtle"><span className="shrink-0 px-3 text-xs text-slate">/people/</span><input name="handle" className="field-control min-w-0 border-0" defaultValue={values.handle ?? ""} minLength={3} maxLength={64} autoCapitalize="none" autoCorrect="off" spellCheck={false} /></div></ProfileField>
          <ProfileField label="Apresentação" help="Sua atuação em uma frase. Necessária para publicar o perfil."><input className="field-control" name="headline" defaultValue={values.headline ?? ""} maxLength={180} placeholder="Ex.: Pesquisadora em biotecnologia e inovação" /></ProfileField>
          <div className="grid gap-4 sm:grid-cols-2"><ProfileField label="Cidade"><input className="field-control" name="city" defaultValue={values.city ?? ""} maxLength={120} autoComplete="address-level2" /></ProfileField><ProfileField label="Estado"><input className="field-control" name="state" defaultValue={values.state ?? ""} maxLength={120} autoComplete="address-level1" /></ProfileField></div>
          <ProfileField label="País"><input className="field-control" name="country" defaultValue={values.country ?? ""} maxLength={120} autoComplete="country-name" /></ProfileField>
        </> : null}
        {section === "about" ? <ProfileField label="Sobre sua trajetória" help="Descreva sua atuação, experiências e o que pretende desenvolver."><textarea className="field-control" name="bio" defaultValue={values.bio ?? ""} rows={7} maxLength={4000} /></ProfileField> : null}
        {section === "topics" ? <>
          <ProfileField label="Competências" help="Uma competência por linha. Até 20, com até 80 caracteres cada."><textarea className="field-control" name="skills" defaultValue={values.skills.join("\n")} rows={5} placeholder={"Pesquisa aplicada\nInteligência artificial"} /></ProfileField>
          <ProfileField label="Áreas de interesse" help="Um interesse por linha. Essas informações ajudam a explicar a relevância das oportunidades."><textarea className="field-control" name="interests" defaultValue={values.interests.join("\n")} rows={5} /></ProfileField>
        </> : null}
        {section === "discovery" ? <>
          <label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" name="directoryEnabled" defaultChecked={values.directoryEnabled} className="mt-1 h-5 w-5 shrink-0" /><span>Permita que outras pessoas na plataforma encontrem seu perfil para oportunidades de colaboração.</span></label>
          <p className="text-xs leading-5 text-slate">A descoberta exige endereço, apresentação e visibilidade para pessoas na plataforma ou público. Seu perfil só será publicado na web com a confirmação própria da publicação. Competências e interesses seguem sua escolha de privacidade.</p>
          <ProfileField label="Disponibilidade para colaborar"><select className="field-control" name="collaborationStatus" defaultValue={values.collaborationStatus}>{Object.entries(collaborationStatusLabels).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></ProfileField>
          <ProfileField label="Interesses de colaboração" help="Opcional. Até 500 caracteres para explicar os projetos aos quais você gostaria de contribuir."><textarea className="field-control" name="collaborationNote" defaultValue={values.collaborationNote ?? ""} maxLength={500} rows={4} placeholder="Ex.: Interesse em projetos de IA aplicada à saúde e dados públicos." /></ProfileField>
        </> : null}
        {section === "privacy" ? <><div className="rounded-lg bg-surface-subtle p-3 text-xs leading-5 text-slate"><p>A opção público só libera o perfil após confirmar sua publicação. Ao restringir o perfil, a publicação é retirada.</p><ul className="mt-2 space-y-1">{Object.entries(visibilityLabels).map(([scope, label]) => <li key={scope}><strong>{label}:</strong> {visibilityDescriptions[scope as VisibilityScope]}</li>)}</ul></div>{privacyFields.map(([name, label]) => <VisibilityControl key={name} name={name} value={values[name]} label={label} />)}</> : null}
      </fieldset>{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}<button className="button-primary w-full" disabled={pending}>{pending ? "Salvando…" : "Salvar alterações"}</button></form>
    </Dialog></>;
}
