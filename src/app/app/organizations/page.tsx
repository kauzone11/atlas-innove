import { redirect } from "next/navigation";

import { OrganizationSelector } from "@/components/organization-selector";
import { ROLE_LABELS } from "@/lib/domain";
import { getAuthenticatedSession } from "@/lib/auth/session";

export default async function OrganizationsPage() {
  const auth = await getAuthenticatedSession();
  if (!auth) {
    redirect("/login");
  }
  const organizations = auth.memberships.map((membership) => ({
    id: membership.organizationId,
    name: membership.organization.name,
    role: ROLE_LABELS[membership.role],
  }));

  return (
    <div className="max-w-2xl space-y-7">
      <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Contexto de trabalho</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Suas organizações</h1><p className="mt-3 text-slate">O contexto ativo é salvo na sessão e só pode ser alterado para uma organização em que você tenha associação ativa.</p></div>
      {organizations.length ? <OrganizationSelector organizations={organizations} activeId={auth.session.activeOrganizationId} /> : <div className="rounded-xl border border-line bg-white p-6 text-sm text-slate">Sua conta ainda não possui uma organização ativa.</div>}
    </div>
  );
}
