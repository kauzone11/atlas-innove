"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type OrganizationOption = { id: string; name: string; role: string };

export function OrganizationSelector({ organizations, activeId }: { organizations: OrganizationOption[]; activeId: string | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function select(organizationId: string) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/select-organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      if (!response.ok) {
        setError("Não foi possível selecionar esta organização.");
        return;
      }
      router.push("/app");
      router.refresh();
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      {organizations.map((organization) => (
        <button key={organization.id} type="button" disabled={pending} onClick={() => select(organization.id)} className={`flex w-full items-center justify-between rounded-xl border bg-white p-4 text-left hover:border-accent ${activeId === organization.id ? "border-accent" : "border-line"}`}>
          <span><span className="block font-semibold text-ink">{organization.name}</span><span className="mt-1 block text-sm text-slate">{organization.role}</span></span>
          <span className="text-sm font-semibold text-accent">{activeId === organization.id ? "Selecionada" : "Selecionar"}</span>
        </button>
      ))}
      {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}
