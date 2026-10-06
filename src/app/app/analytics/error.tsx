"use client";

import Link from "next/link";

export default function AnalyticsError({ reset }: { reset: () => void }) {
  return <div className="analytics-empty" role="alert"><h2>Não foi possível consultar este recorte</h2><p>Tente novamente. Se o problema persistir, amplie ou reduza o escopo a partir das análises do portfólio.</p><div className="mt-5 flex flex-wrap gap-2"><button type="button" className="button-primary" onClick={reset}>Tentar novamente</button><Link href="/app/analytics" className="button-secondary">Abrir análises</Link></div></div>;
}
