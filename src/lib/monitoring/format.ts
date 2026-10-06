export function formatMonitoringDate(value: string | null): string {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value)) : "Sem data definida";
}

export function formatIndicatorValue(value: number | string | null, valueType: string, unit?: string | null): string {
  if (value === null) return "—";
  if (typeof value === "string") return value;
  if (valueType === "CURRENCY") {
    if (unit === "R$" || !unit) return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 }).format(value);
    return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ${unit}`;
  }
  const formatted = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function observationStatusLabel(status: string | null): string {
  return ({ PENDING: "Pendente", IN_PROGRESS: "Em preenchimento", SUBMITTED: "Enviada", MISSED: "Não respondida" } as Record<string, string>)[status ?? ""] ?? "Sem observação";
}
