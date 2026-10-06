"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { personalRequest } from "@/components/personal/record-form";

export function ReviewSafetyReport({ reportId }: { reportId: string }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  async function review(status: "REVIEWED" | "DISMISSED" | "ACTIONED") {
    setPending(true); setError(null);
    try { await personalRequest(`/api/platform/safety-reports/${reportId}`, "PATCH", { status }); router.refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Não foi possível registrar a análise."); }
    finally { setPending(false); }
  }
  return <div className="space-y-2"><div className="flex flex-wrap gap-2"><button className="button-secondary" type="button" disabled={pending} onClick={() => void review("REVIEWED")}>Marcar como analisada</button><button className="button-secondary" type="button" disabled={pending} onClick={() => void review("DISMISSED")}>Arquivar sem ação</button><button className="button-secondary" type="button" disabled={pending} onClick={() => void review("ACTIONED")}>Registrar ação tomada</button></div><p className="text-xs text-slate">Registre a análise ou uma ação já realizada pela plataforma. Estas opções não suspendem contas.</p>{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}</div>;
}
