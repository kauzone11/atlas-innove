import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { StatusBadge } from "@/components/ui";
import { getPublicProject } from "@/lib/participants/public-project";
import { projectStatusLabels } from "@/lib/participants/presentation";
import { formatMonitoringDate } from "@/lib/monitoring/format";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = await getPublicProject((await params).slug);
  if (!project) return { title: "Projeto não encontrado", robots: { index: false, follow: false } };
  return { title: `${project.name} · Atlas Innove`, description: project.summary.slice(0, 160), alternates: { canonical: `https://innove.ouseagency.com/projects/${project.slug}` }, robots: { index: true, follow: true } };
}
export default async function PublicProjectPage({ params }: Props) {
  const project = await getPublicProject((await params).slug);
  if (!project) notFound();
  const links = [["Site do projeto", project.websiteUrl], ["Repositório", project.repositoryUrl], ["Demonstração", project.demoUrl]].filter((entry): entry is [string, string] => Boolean(entry[1]));
  return <PublicShell><article className="space-y-8"><header className="border-b border-line pb-7"><p className="text-xs font-semibold uppercase tracking-wider text-accent-hover">Projeto de inovação</p><h1 className="mt-3 max-w-4xl break-words text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{project.name}</h1><p className="mt-4 max-w-3xl whitespace-pre-wrap break-words text-base leading-8 text-slate">{project.summary}</p><div className="mt-5 flex flex-wrap items-center gap-3"><StatusBadge label={projectStatusLabels[project.status]} tone="neutral" /><span className="text-xs text-slate">Informações declaradas pelos responsáveis</span></div></header><div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_16rem]"><div className="min-w-0 space-y-8">{project.description ? <section><h2 className="text-lg font-semibold">Sobre o projeto</h2><p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate">{project.description}</p></section> : null}{project.participations.length ? <section className="border-t border-line pt-7"><h2 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck size={20} aria-hidden="true" />Participações registradas na plataforma</h2><ul className="mt-4 divide-y divide-line">{project.participations.map((participation) => <li key={participation.id} className="py-4"><p className="font-medium">{participation.program}</p><p className="mt-1 text-sm text-slate">{participation.institution}</p><Link href={participation.callUrl} className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-accent-hover underline underline-offset-4">{participation.call}</Link><p className="text-xs text-slate">Selecionado · Resultado publicado em {formatMonitoringDate(participation.date)}</p></li>)}</ul></section> : null}</div>{project.thematicAreas.length || links.length ? <aside className="space-y-7 border-t border-line pt-6 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">{project.thematicAreas.length ? <section><h2 className="text-sm font-semibold">Áreas temáticas</h2><ul className="mt-3 space-y-2">{project.thematicAreas.map((area) => <li key={area} className="break-words text-sm text-slate">{area}</li>)}</ul></section> : null}{links.length ? <section><h2 className="text-sm font-semibold">Links do projeto</h2><ul className="mt-3">{links.map(([label, href]) => <li key={label}><a className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent-hover underline underline-offset-4" href={href} target="_blank" rel="noopener noreferrer">{label}<ExternalLink size={14} aria-hidden="true" /></a></li>)}</ul></section> : null}</aside> : null}</div></article></PublicShell>;
}
