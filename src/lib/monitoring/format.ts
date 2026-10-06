import { ExactDecimal } from "@/lib/analytics/aggregates";
import type { Prisma } from "@prisma/client";

export function formatMonitoringDate(value: string | null): string {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value)) : "Sem data definida";
}

export function formatIndicatorValue(value: number | string | Prisma.Decimal | null, valueType: string, unit?: string | null): string {
  if (value === null) return "—";
  if (valueType === "ENUM") return String(value);
  if (valueType === "CURRENCY") {
    try {
      const decimal = new ExactDecimal(value);
      if (!decimal.isFinite()) return "—";
      const [integer, fraction] = decimal.abs().toFixed(2).split(".");
      const formatted = `${decimal.isNegative() && !decimal.isZero() ? "-" : ""}${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${fraction}`;
      return unit === "R$" || !unit ? `${decimal.isNegative() && !decimal.isZero() ? "-" : ""}R$\u00a0${formatted.replace(/^-/, "")}` : `${formatted} ${unit}`;
    } catch { return "—"; }
  }
  const formatted = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(Number(value));
  return unit ? `${formatted} ${unit}` : formatted;
}

export function observationStatusLabel(status: string | null): string {
  return ({ PENDING: "Pendente", IN_PROGRESS: "Em preenchimento", SUBMITTED: "Enviada", MISSED: "Não respondida" } as Record<string, string>)[status ?? ""] ?? "Sem observação";
}
