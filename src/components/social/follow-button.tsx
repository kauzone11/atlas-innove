"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, UserPlus } from "lucide-react";
import { personalRequest } from "@/components/personal/record-form";

export function FollowButton({ userId, following = false, canFollow = true, primary = false }: { userId: string; following?: boolean; canFollow?: boolean; primary?: boolean }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  if (!following && !canFollow) return null;
  return <div className="min-w-0"><button type="button" className={primary && !following ? "button-primary" : "button-secondary"} disabled={pending} aria-pressed={following} aria-busy={pending} onClick={async () => { setPending(true); setError(null); try { await personalRequest(`/api/personal/social/follows/${userId}`, "POST", { following: !following }); router.refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível alterar o acompanhamento."); } finally { setPending(false); } }}>{following ? <Check size={16} aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}{following ? "Seguindo" : "Seguir"}</button>{error ? <p role="alert" className="mt-2 max-w-xs text-xs text-danger">{error}</p> : null}</div>;
}

