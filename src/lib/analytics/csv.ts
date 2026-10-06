import { DomainConflictError } from "@/lib/errors";

export const MAX_EXPORT_ROWS = 50_000;
export type CsvCell = string | number | null;

export function escapeCsvCell(value: CsvCell): string {
  const raw = value === null ? "" : String(value);
  // Spreadsheet importers can ignore leading whitespace and controls before formula tokens.
  const escaped = /^[\s\u0000-\u001f\u007f-\u009f]*[=+\-@]/u.test(raw) || /^[\t\r\n]/u.test(raw) ? `'${raw}` : raw;
  return `"${escaped.replaceAll('"', '""')}"`;
}

export function serializeCsv(columns: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  if (rows.length > MAX_EXPORT_ROWS) throw new DomainConflictError("ANALYTICS_EXPORT_ROW_LIMIT");
  if (rows.some((row) => row.length !== columns.length)) throw new Error("ANALYTICS_EXPORT_COLUMNS_MISMATCH");
  return `\uFEFF${[columns, ...rows].map((row) => row.map(escapeCsvCell).join(";")).join("\r\n")}\r\n`;
}
