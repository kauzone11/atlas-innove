"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, UserPlus } from "lucide-react";

export function InstitutionFollowButton({ organizationId, following }: { organizationId: string; following: boolean }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  return <div className="min-w-0">
    <button type="button" className={following ? "button-secondary" : "button-primary"} disabled={pending} aria-pressed={following} aria-busy={pending} onClick={async () => {
      setPending(true); setError(null);
      try {
        const response = await fetch(`/api/institutions/${encodeURIComponent(organizationId)}/follow`, { method: following ? "DELETE" : "POST" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Não foi possível alterar o acompanhamento.");
        router.refresh();
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível alterar o acompanhamento."); }
      finally { setPending(false); }
    }}>{following ? <Check size={16} aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}{following ? "Seguindo" : "Seguir instituição"}</button>
    {error ? <p className="mt-2 max-w-xs text-xs text-danger" role="alert">{error}</p> : null}
  </div>;
}
