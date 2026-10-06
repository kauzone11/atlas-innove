import Link from "next/link";
import { ArrowUpRight, BadgeCheck, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import type { VisibleProfile } from "@/lib/profiles/service";
import { projectStatusLabels } from "@/lib/participants/presentation";

export function formatProfileDate(value: string | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00.000Z`));
}
export function profileMonogram(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "AI";
}
function ProfileSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <section className="border-t border-line py-7"><h2 className="text-lg font-semibold tracking-[-0.02em]">{title}</h2>{description ? <p className="mt-1 text-sm text-slate">{description}</p> : null}<div className="mt-4">{children}</div></section>;
}
function TopicList({ topics }: { topics: string[] }) {
  return <ul className="flex flex-wrap gap-2">{topics.map((topic) => <li key={topic} className="max-w-full break-words rounded-md bg-surface-subtle px-3 py-1.5 text-sm">{topic}</li>)}</ul>;
}

export function ProfileRenderer({ profile }: { profile: VisibleProfile }) {
  return <article className="mx-auto w-full max-w-4xl break-words">
    <header className="pb-8 pt-2">
      <div className="flex items-start gap-4 sm:gap-5"><span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-lg font-semibold text-accent-hover">{profileMonogram(profile.fullName)}</span><div className="min-w-0"><p className="text-xs font-medium uppercase tracking-[0.14em] text-slate">Perfil de inovação</p><h1 className="mt-1 text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl">{profile.fullName}</h1>{profile.headline ? <p className="mt-3 max-w-2xl text-lg leading-relaxed text-slate">{profile.headline}</p> : null}{profile.location.length ? <p className="mt-3 flex items-start gap-2 text-sm text-slate"><MapPin size={15} className="mt-0.5 shrink-0" aria-hidden="true" />{profile.location.join(" · ")}</p> : null}</div></div>
    </header>
    {profile.bio ? <ProfileSection title="Sobre"><p className="max-w-3xl whitespace-pre-line leading-7 text-slate">{profile.bio}</p></ProfileSection> : null}
    {profile.skills?.length ? <ProfileSection title="Competências"><TopicList topics={profile.skills} /></ProfileSection> : null}
    {profile.interests?.length ? <ProfileSection title="Áreas de interesse"><TopicList topics={profile.interests} /></ProfileSection> : null}
    {profile.experience?.length ? <ProfileSection title="Experiência" description="Informações declaradas pela pessoa participante."><ol className="space-y-6">{profile.experience.map((record) => <li key={record.id}><h3 className="font-semibold">{record.title}</h3><p className="mt-1 text-sm">{record.organizationName}</p><p className="mt-1 text-sm text-slate">{formatProfileDate(record.startsAt)}{record.current ? " → atual" : record.endsAt ? ` → ${formatProfileDate(record.endsAt)}` : ""}</p>{record.description ? <p className="mt-2 max-w-3xl whitespace-pre-line text-sm leading-6 text-slate">{record.description}</p> : null}</li>)}</ol></ProfileSection> : null}
    {profile.education?.length ? <ProfileSection title="Formação" description="Informações declaradas pela pessoa participante."><ol className="space-y-6">{profile.education.map((record) => <li key={record.id}><h3 className="font-semibold">{record.course}</h3><p className="mt-1 text-sm">{record.institution}{record.degree ? ` · ${record.degree}` : ""}</p>{record.startsAt || record.endsAt ? <p className="mt-1 text-sm text-slate">{[formatProfileDate(record.startsAt), formatProfileDate(record.endsAt)].filter(Boolean).join(" → ")}</p> : null}{record.description ? <p className="mt-2 max-w-3xl whitespace-pre-line text-sm leading-6 text-slate">{record.description}</p> : null}</li>)}</ol></ProfileSection> : null}
    {profile.verifiedParticipations?.length ? <ProfileSection title="Participações verificadas" description="Participações registradas a partir de seleções publicadas no Atlas Innove."><ul className="space-y-5">{profile.verifiedParticipations.map((participation) => <li key={participation.id} className="flex items-start gap-3"><BadgeCheck size={20} className="mt-0.5 shrink-0 text-success" aria-hidden="true" /><div className="min-w-0"><h3 className="font-semibold">{participation.program}</h3><p className="mt-1 text-sm text-slate">{participation.institution} · {participation.call}</p><p className="mt-1 text-sm text-slate">Selecionado · {formatProfileDate(participation.date)}</p>{participation.projectName ? participation.projectUrl ? <Link className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-accent-hover hover:underline" href={participation.projectUrl}>{participation.projectName}<ArrowUpRight size={15} aria-hidden="true" /></Link> : <p className="mt-2 text-sm">{participation.projectName}</p> : null}</div></li>)}</ul></ProfileSection> : null}
    {profile.publicProjects?.length ? <ProfileSection title="Projetos públicos"><ul className="space-y-5">{profile.publicProjects.map((project) => <li key={project.url}><div className="flex flex-wrap items-center justify-between gap-2"><Link href={project.url} className="inline-flex min-h-11 items-center gap-1 font-semibold text-accent-hover hover:underline">{project.name}<ArrowUpRight size={16} aria-hidden="true" /></Link><span className="text-xs text-slate">{projectStatusLabels[project.status] ?? project.status}</span></div><p className="mt-1 max-w-3xl text-sm leading-6 text-slate">{project.summary}</p>{project.thematicAreas.length ? <p className="mt-2 text-xs text-slate">{project.thematicAreas.join(" · ")}</p> : null}</li>)}</ul></ProfileSection> : null}
    {profile.links?.length ? <ProfileSection title="Links"><ul className="flex flex-wrap gap-x-6 gap-y-2">{profile.links.map((link) => <li key={`${link.type}-${link.url}`}><a className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent-hover hover:underline" href={link.url} target="_blank" rel="noopener noreferrer">{link.label}<ArrowUpRight size={15} aria-hidden="true" /></a></li>)}</ul></ProfileSection> : null}
  </article>;
}
