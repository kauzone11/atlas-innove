"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";

import { Dialog } from "@/components/dialog";
import { StatusBadge } from "@/components/ui";

type Member = { id: string; role: string; status: "ACTIVE" | "DISABLED"; user: { email: string; fullName: string } };

export function TeamManager({ organizationId, canManage }: { organizationId: string; canManage: boolean }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("VIEWER");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);

  const loadMembers = useCallback(async () => {
    const response = await fetch(`/api/organizations/${organizationId}/members`);
    if (!response.ok) throw new Error("Não foi possível carregar a equipe.");
    const payload = (await response.json()) as { members: Member[] };
    setMembers(payload.members);
  }, [organizationId]);

  useEffect(() => { void loadMembers().catch((reason: Error) => setError(reason.message)); }, [loadMembers]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setNotice(null); setError(null);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role }) });
      const payload = (await response.json()) as { error?: string; developmentToken?: string };
      if (!response.ok) { setError(payload.error ?? "Não foi possível criar o convite."); return; }
      setEmail(""); setOpen(false); setNotice(payload.developmentToken ? `Convite criado. Token de desenvolvimento: ${payload.developmentToken}` : "Convite criado. A entrega por e-mail ainda não está configurada."); await loadMembers();
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }

  async function toggle(member: Member) {
    setPending(true); setNotice(null); setError(null);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/members/${member.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: member.status === "ACTIVE" ? "DISABLED" : "ACTIVE" }) });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) { setError(payload.error ?? "Não foi possível atualizar o membro."); return; }
      await loadMembers();
    } catch { setError("Não foi possível conectar ao servidor."); } finally { setPending(false); }
  }

  return <div className="space-y-4">
    {canManage ? <div className="flex justify-end"><button type="button" className="button-primary" onClick={() => setOpen(true)}><Plus size={15} aria-hidden="true" /> Convidar pessoa</button><Dialog open={open} onClose={() => setOpen(false)} title="Convidar pessoa" description="Defina o papel antes de criar o convite."><form onSubmit={invite} className="space-y-5"><label className="block space-y-2 text-sm font-medium text-ink" htmlFor="invite-email"><span>E-mail</span><input id="invite-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@instituicao.org" autoComplete="email" className="field-control" /></label><label className="block space-y-2 text-sm font-medium text-ink" htmlFor="invite-role"><span>Papel</span><select id="invite-role" value={role} onChange={(event) => setRole(event.target.value)} className="field-control"><option value="VIEWER">Visualizador</option><option value="ANALYST">Analista</option><option value="MANAGER">Gestor</option><option value="ADMIN">Administrador</option></select></label><button disabled={pending} className="button-primary w-full">{pending ? "Convidando…" : "Criar convite"}</button></form></Dialog></div> : null}
    {notice ? <p className="rounded-lg border border-success/20 bg-success-soft px-4 py-3 text-sm text-success" role="status">{notice}</p> : null}
    {error ? <p className="rounded-lg border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">{error}</p> : null}
    <section className="workspace-card overflow-hidden" aria-labelledby="team-members"><div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-3.5 sm:px-4"><h2 id="team-members" className="text-sm font-semibold text-ink">Equipe</h2><span className="text-[0.5625rem] text-slate">{members.length} {members.length === 1 ? "pessoa" : "pessoas"}</span></div>{members.length ? <><table className="data-table"><caption className="sr-only">Pessoas com acesso à organização</caption><thead><tr><th>Pessoa</th><th>E-mail</th><th>Papel</th><th>Status</th><th><span className="sr-only">Ação</span></th></tr></thead><tbody>{members.map((member) => <tr key={member.id}><td><div className="flex items-center gap-2.5"><span className="profile-monogram h-7 w-7 rounded-lg">{initials(member.user.fullName)}</span><strong className="font-semibold">{member.user.fullName}</strong></div></td><td>{member.user.email}</td><td>{roleLabel(member.role)}</td><td><StatusBadge label={member.status === "ACTIVE" ? "Ativo" : "Desativado"} tone={member.status === "ACTIVE" ? "success" : "neutral"} /></td><td>{canManage && member.role !== "OWNER" ? <button type="button" disabled={pending} onClick={() => void toggle(member)} className="button-secondary min-h-8 px-2.5 text-[0.5625rem]">{member.status === "ACTIVE" ? "Desativar" : "Reativar"}</button> : null}</td></tr>)}</tbody></table><div className="mobile-records">{members.map((member) => <article key={member.id} className="mobile-record"><div className="flex min-w-0 items-center gap-2.5"><span className="profile-monogram h-7 w-7 rounded-lg">{initials(member.user.fullName)}</span><div className="min-w-0"><p className="truncate">{member.user.fullName}</p><small className="truncate">{member.user.email}</small></div></div><StatusBadge label={member.status === "ACTIVE" ? "Ativo" : "Desativado"} tone={member.status === "ACTIVE" ? "success" : "neutral"} /><div className="mobile-record-meta"><span>{roleLabel(member.role)}</span>{canManage && member.role !== "OWNER" ? <button type="button" disabled={pending} onClick={() => void toggle(member)} className="font-semibold text-accent-hover">{member.status === "ACTIVE" ? "Desativar" : "Reativar"}</button> : null}</div></article>)}</div></> : <p className="px-4 py-10 text-sm text-slate">Nenhuma pessoa encontrada.</p>}</section>
  </div>;
}

function initials(name: string): string { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "AI"; }
function roleLabel(role: string): string { return ({ OWNER: "Responsável", ADMIN: "Administrador", MANAGER: "Gestor", ANALYST: "Analista", VIEWER: "Visualizador" } as Record<string, string>)[role] ?? role; }
