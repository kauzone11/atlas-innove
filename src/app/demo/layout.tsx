import type { Metadata } from "next";
import { DemoShell } from "@/components/demo/demo-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Demonstração",
  description: "Demonstração pública do acompanhamento longitudinal no Atlas Innove.",
  robots: { index: false, follow: false },
  openGraph: { title: "Atlas Innove — Demonstração", description: "Acompanhamento longitudinal de empreendimentos apoiados.", type: "website" },
};

export default function DemoLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <DemoShell>{children}</DemoShell>;
}
