import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DemoShell } from "@/components/demo/demo-shell";
import { hasConfiguredDemoOrganization } from "@/lib/demo/read-model";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Demonstração",
  description: "Demonstração pública do acompanhamento longitudinal no Atlas Innove.",
  robots: { index: false, follow: false },
  openGraph: { title: "Atlas Innove — Demonstração", description: "Acompanhamento longitudinal de empreendimentos apoiados.", type: "website" },
};

export default async function DemoLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!(await hasConfiguredDemoOrganization())) notFound();
  return <DemoShell>{children}</DemoShell>;
}
