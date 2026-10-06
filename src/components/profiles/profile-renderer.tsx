import Link from "next/link";
import { ArrowUpRight, BadgeCheck, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar } from "@/components/media/avatar";
import { MediaImage } from "@/components/media/media-image";
import type { VisibleProfile } from "@/lib/profiles/service";
import { projectStatusLabels } from "@/lib/participants/presentation";
export { avatarMonogram as profileMonogram } from "@/lib/media/identity";

export function formatProfileDate(value: string | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00.000Z`));
}
function ProfileSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <section className="social-profile-section"><h2 className="text-lg font-semibold tracking-[-0.02em]">{title}</h2>{description ? <p className="mt-1 text-sm text-slate">{description}</p> : null}<div className="mt-4">{children}</div></section>;
}
function TopicList({ topics }: { topics: string[] }) {
  const list = (items: string[]) => <ul className="social-profile-topics">{items.map((topic) => <li key={topic}>{topic}</li>)}</ul>;
  return <>{list(topics.slice(0, 6))}{topics.length > 6 ? <details className="social-topic-disclosure"><summary>Ver mais ({topics.length - 6})</summary>{list(topics.slice(6))}</details> : null}</>;
}

export function ProfileRenderer({ profile, actions, counts, featured, activity }: { profile: VisibleProfile; actions?: ReactNode; counts?: ReactNode; featured?: ReactNode; activity?: ReactNode }) {
  const currentExperience = profile.experience?.find((record) => record.current);
  return <article className="social-profile social-surface mx-auto w-full max-w-5xl break-words">
    <header className="social-profile-intro">
      <div className={`social-profile-cover${profile.coverMedia ? " social-profile-cover-image" : ""}`} aria-hidden="true">{profile.coverMedia ? <MediaImage media={profile.coverMedia} alt="" loading="eager" sizes="(max-width: 767px) 100vw, 1024px" /> : <><span className="social-cover-geometry" /><span>Atlas Innove</span></>}</div>
      <div className="social-profile-introduction">
        <Avatar name={profile.fullName} media={profile.avatarMedia} size="profile" className="social-profile-avatar" />
        <div className="social-profile-identity"><div className="min-w-0"><h1>{profile.fullName || "Seu perfil"}</h1>{profile.headline ? <p className="social-profile-headline">{profile.headline}</p> : null}{profile.location.length ? <p className="mt-3 flex items-start gap-2 text-sm text-slate"><MapPin size={15} className="mt-0.5 shrink-0" aria-hidden="true" />{profile.location.join(" · ")}</p> : null}</div>{currentExperience ? <p className="social-profile-context"><span className="block text-sm font-medium text-ink">{currentExperience.organizationName}</span><span className="mt-1 block text-sm text-slate">{currentExperience.title}</span></p> : null}</div>
        {counts ? <div className="social-profile-counts">{counts}</div> : null}
        {actions ? <div className="social-profile-actions">{actions}</div> : null}
      </div>
    </header>
    {profile.bio ? <ProfileSection title="Sobre"><p className="max-w-3xl whitespace-pre-line leading-7 text-slate">{profile.bio}</p></ProfileSection> : null}
    {featured}
    {activity}
    {profile.experience?.length ? <ProfileSection title="Experiência" description="Informações declaradas pela pessoa participante."><ol className="social-profile-timeline">{profile.experience.map((record) => <li key={record.id}><h3 className="font-semibold">{record.title}</h3><p className="mt-1 text-sm">{record.organizationName}</p><p className="mt-1 text-sm text-slate">{formatProfileDate(record.startsAt)}{record.current ? " → atual" : record.endsAt ? ` → ${formatProfileDate(record.endsAt)}` : ""}</p>{record.description ? <p className="mt-2 max-w-3xl whitespace-pre-line text-sm leading-6 text-slate">{record.description}</p> : null}</li>)}</ol></ProfileSection> : null}
    {profile.education?.length ? <ProfileSection title="Formação" description="Informações declaradas pela pessoa participante."><ol className="social-profile-timeline">{profile.education.map((record) => <li key={record.id}><h3 className="font-semibold">{record.course}</h3><p className="mt-1 text-sm">{record.institution}{record.degree ? ` · ${record.degree}` : ""}</p>{record.startsAt || record.endsAt ? <p className="mt-1 text-sm text-slate">{[formatProfileDate(record.startsAt), formatProfileDate(record.endsAt)].filter(Boolean).join(" → ")}</p> : null}{record.description ? <p className="mt-2 max-w-3xl whitespace-pre-line text-sm leading-6 text-slate">{record.description}</p> : null}</li>)}</ol></ProfileSection> : null}
    {profile.skills?.length ? <ProfileSection title="Competências"><TopicList topics={profile.skills} /></ProfileSection> : null}
    {profile.interests?.length ? <ProfileSection title="Áreas de interesse"><TopicList topics={profile.interests} /></ProfileSection> : null}
    {profile.verifiedParticipations?.length ? <ProfileSection title="Participações verificadas" description="Participações registradas a partir de seleções publicadas no Atlas Innove."><ul className="social-profile-records">{profile.verifiedParticipations.map((participation) => <li key={participation.id} className="flex items-start gap-3"><BadgeCheck size={20} className="mt-0.5 shrink-0 text-success" aria-hidden="true" /><div className="min-w-0"><h3 className="font-semibold">{participation.program}</h3><p className="mt-1 text-sm text-slate">{participation.institution} · {participation.call}</p><p className="mt-1 text-sm text-slate">Selecionado · {formatProfileDate(participation.date)}</p>{participation.projectName ? participation.projectUrl ? <Link className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-accent-hover hover:underline" href={participation.projectUrl}>{participation.projectName}<ArrowUpRight size={15} aria-hidden="true" /></Link> : <p className="mt-2 text-sm">{participation.projectName}</p> : null}</div></li>)}</ul></ProfileSection> : null}
    {profile.publicProjects?.length ? <ProfileSection title="Projetos públicos"><ul className="social-profile-records">{profile.publicProjects.map((project) => <li key={project.url}><div className="flex flex-wrap items-center justify-between gap-2"><Link href={project.url} className="inline-flex min-h-11 items-center gap-1 font-semibold text-accent-hover hover:underline">{project.name}<ArrowUpRight size={16} aria-hidden="true" /></Link><span className="text-xs text-slate">{projectStatusLabels[project.status] ?? project.status}</span></div><p className="mt-1 max-w-3xl text-sm leading-6 text-slate">{project.summary}</p>{project.thematicAreas.length ? <p className="mt-2 text-xs text-slate">{project.thematicAreas.join(" · ")}</p> : null}</li>)}</ul></ProfileSection> : null}
    {profile.links?.length ? <ProfileSection title="Links"><ul className="flex flex-wrap gap-x-6 gap-y-2">{profile.links.map((link) => <li key={`${link.type}-${link.url}`}><a className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent-hover hover:underline" href={link.url} target="_blank" rel="noopener noreferrer">{link.label}<ArrowUpRight size={15} aria-hidden="true" /></a></li>)}</ul></ProfileSection> : null}
  </article>;
}
