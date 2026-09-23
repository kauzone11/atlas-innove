import Link from "next/link";
import { Building2, Settings, Users } from "lucide-react";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/logout-button";
import { getAuthenticatedSession } from "@/lib/auth/session";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const auth = await getAuthenticatedSession();
  if (!auth) {
    redirect("/login");
  }
  const activeOrganization = auth.memberships.find(
    (membership) => membership.organizationId === auth.session.activeOrganizationId,
  ) ?? (auth.memberships.length === 1 ? auth.memberships[0] : null);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4 lg:px-8">
          <div className="flex min-w-0 items-center gap-6">
            <Link href="/app" className="shrink-0 text-lg font-semibold tracking-tight text-ink">Atlas Innove</Link>
            {activeOrganization ? <span className="hidden truncate border-l border-line pl-6 text-sm text-slate sm:block">{activeOrganization.organization.name}</span> : null}
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-slate md:block">{auth.user.profile?.fullName ?? auth.user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8 lg:flex-row lg:px-8">
        <aside className="w-full shrink-0 lg:w-56">
          <nav aria-label="Navegação da organização" className="flex gap-2 overflow-x-auto lg:flex-col">
            <NavLink href="/app" label="Visão geral" icon={<Building2 size={17} aria-hidden="true" />} />
            <NavLink href="/app/organizations" label="Organizações" icon={<Building2 size={17} aria-hidden="true" />} />
            {activeOrganization ? <NavLink href="/app/team" label="Equipe" icon={<Users size={17} aria-hidden="true" />} /> : null}
            {activeOrganization ? <NavLink href="/app/settings" label="Configurações" icon={<Settings size={17} aria-hidden="true" />} /> : null}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

function NavLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return <Link href={href} className="inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate hover:bg-white hover:text-ink lg:w-full">{icon}{label}</Link>;
}
