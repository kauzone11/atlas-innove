import type { ReactNode } from "react";

import { AuthLogo } from "@/components/auth/auth-logo";

export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <main className="flex min-h-[100dvh] items-center justify-center bg-canvas px-4 py-8 sm:px-6 sm:py-12"><section className="w-full max-w-[30rem] rounded-[0.9rem] border border-line bg-white p-6 shadow-panel sm:p-8"><AuthLogo /><div className="mt-10"><h1 className="text-[1.75rem] font-semibold tracking-[-0.04em] text-ink">{title}</h1><p className="mt-2 text-sm leading-6 text-slate">{description}</p></div><div className="mt-7">{children}</div></section></main>;
}
