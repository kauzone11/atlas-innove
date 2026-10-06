import { createHash } from "node:crypto";
import { ImportInputError } from "@/lib/imports/errors";
import { IMPORT_LIMITS } from "@/lib/imports/limits";

export type CsvDelimiter = "," | ";";
export type ParsedCsvRow = { rowNumber: number; data: Record<string, string> };

function detectDelimiter(text: string): CsvDelimiter {
  let quoted = false; let comma = 0; let semicolon = 0;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') index++;
      else quoted = !quoted;
    } else if (!quoted) {
      if (character === "\r" || character === "\n") break;
      if (character === ",") comma++;
      if (character === ";") semicolon++;
    }
  }
  if (comma && semicolon) throw new ImportInputError("CSV_DELIMITER_AMBIGUOUS", 1);
  return semicolon ? ";" : ",";
}

export function parseImportCsv(bytes: Uint8Array, delimiterOption: CsvDelimiter | "auto" = "auto") {
  if (bytes.byteLength > IMPORT_LIMITS.maxBytes) throw new ImportInputError("CSV_FILE_TOO_LARGE");
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, ""); }
  catch { throw new ImportInputError("CSV_INVALID_UTF8"); }
  if (!text.trim()) throw new ImportInputError("CSV_EMPTY");
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw new ImportInputError("CSV_CONTROL_CHARACTER");
  if (!["auto", ",", ";"].includes(delimiterOption)) throw new ImportInputError("CSV_DELIMITER_INVALID");
  const delimiter = delimiterOption === "auto" ? detectDelimiter(text) : delimiterOption;
  let state: "START" | "UNQUOTED" | "QUOTED" | "CLOSED" = "START";
  let cell = ""; let cells: string[] = []; let line = 1; let rowNumber = 1; let started = false;
  let headers: string[] | undefined;
  const rows: ParsedCsvRow[] = [];
  const append = (value: string) => {
    cell += value;
    if (cell.length > IMPORT_LIMITS.maxCellLength) throw new ImportInputError("CSV_CELL_TOO_LONG", rowNumber);
  };
  const finishCell = () => {
    cells.push(cell); cell = ""; state = "START";
    if (cells.length > IMPORT_LIMITS.maxColumns) throw new ImportInputError("CSV_TOO_MANY_COLUMNS", rowNumber);
  };
  const finishRow = () => {
    finishCell();
    if (!headers) {
      headers = cells.map((header) => header.trim());
      if (headers.some((header) => !header)) throw new ImportInputError("CSV_EMPTY_HEADER", rowNumber);
      if (headers.some((header) => header.length > IMPORT_LIMITS.maxHeaderLength)) throw new ImportInputError("CSV_HEADER_TOO_LONG", rowNumber);
      const normalized = headers.map((header) => header.normalize("NFKC").toLowerCase());
      if (normalized.some((header) => ["__proto__", "prototype", "constructor"].includes(header))) throw new ImportInputError("CSV_RESERVED_HEADER", rowNumber);
      if (new Set(normalized).size !== headers.length) throw new ImportInputError("CSV_DUPLICATE_HEADER", rowNumber);
    } else {
      if (cells.length !== headers.length) throw new ImportInputError("CSV_COLUMN_COUNT", rowNumber);
      if (rows.length >= IMPORT_LIMITS.maxRows) throw new ImportInputError("CSV_TOO_MANY_ROWS", rowNumber);
      rows.push({ rowNumber, data: Object.fromEntries(headers.map((header, index) => [header, cells[index]])) });
    }
    cells = []; started = false;
  };
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (state === "QUOTED") {
      if (character === '"') {
        if (text[index + 1] === '"') { append('"'); index++; }
        else state = "CLOSED";
      } else if (character === "\r" || character === "\n") {
        if (character === "\r" && text[index + 1] === "\n") { append("\r\n"); index++; } else append(character);
        line++;
      } else append(character);
      continue;
    }
    if (character === delimiter) { started = true; finishCell(); continue; }
    if (character === "\r" || character === "\n") {
      if (started || cells.length || cell.length) finishRow();
      if (character === "\r" && text[index + 1] === "\n") index++;
      line++; rowNumber = line; continue;
    }
    if (state === "CLOSED") throw new ImportInputError("CSV_AFTER_QUOTE", rowNumber);
    started = true;
    if (character === '"') {
      if (state !== "START") throw new ImportInputError("CSV_UNEXPECTED_QUOTE", rowNumber);
      state = "QUOTED";
    } else { append(character); state = "UNQUOTED"; }
  }
  if (state === "QUOTED") throw new ImportInputError("CSV_UNCLOSED_QUOTE", rowNumber);
  if (started || cells.length || cell.length) finishRow();
  if (!headers || !rows.length) throw new ImportInputError("CSV_NO_ROWS");
  return { headers, rows, delimiter, sourceDigest: createHash("sha256").update(bytes).digest("hex") };
}
