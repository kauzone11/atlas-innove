import assert from "node:assert/strict";
import test from "node:test";
import { parseImportCsv } from "@/lib/imports/csv";
import { IMPORT_LIMITS } from "@/lib/imports/limits";

test("CSV preserves quoted delimiters, escaped quotes, multiline values, zero and formula text", () => {
  const result = parseImportCsv(Buffer.from('\uFEFFexternal_id,name,note,amount\r\n001,"Empresa, A","linha 1\r\nlinha ""2""",0\r\n002,=SUM(A1:A2),@literal,\r\n'));
  assert.equal(result.delimiter, ",");
  assert.deepEqual(result.headers, ["external_id", "name", "note", "amount"]);
  assert.deepEqual(result.rows, [
    { rowNumber: 2, data: { external_id: "001", name: "Empresa, A", note: 'linha 1\r\nlinha "2"', amount: "0" } },
    { rowNumber: 4, data: { external_id: "002", name: "=SUM(A1:A2)", note: "@literal", amount: "" } },
  ]);
  assert.match(result.sourceDigest, /^[a-f0-9]{64}$/);
  assert.notEqual(result.sourceDigest, parseImportCsv(Buffer.from("external_id,name\na,Name")).sourceDigest);
});

test("semicolon detection ignores quoted delimiters and trims headers only", () => {
  const parsed = parseImportCsv(Buffer.from(' external_id ; name ;note\n001; Empresa A ;"comma, and ; semicolon"'));
  assert.equal(parsed.delimiter, ";");
  assert.deepEqual(parsed.rows[0].data, { external_id: "001", name: " Empresa A ", note: "comma, and ; semicolon" });
  assert.equal(parseImportCsv(Buffer.from("name\nSingle column")).rows[0].data.name, "Single column");
  assert.throws(() => parseImportCsv(Buffer.from("id,name;other\na,b;c")), /CSV_DELIMITER_AMBIGUOUS/);
  assert.deepEqual(parseImportCsv(Buffer.from("id,name;other\na,b;c"), ",").headers, ["id", "name;other"]);
});

test("malformed or unsafe CSV fails before staging", () => {
  const cases = [
    ["id,id\na,b", "CSV_DUPLICATE_HEADER"], ["ID, id \na,b", "CSV_DUPLICATE_HEADER"], ["id,\na,b", "CSV_EMPTY_HEADER"],
    ["__proto__,name\na,b", "CSV_RESERVED_HEADER"], ["constructor,name\na,b", "CSV_RESERVED_HEADER"],
    ['id,name\na,"unterminated', "CSV_UNCLOSED_QUOTE"], ['id,name\na,un"quoted', "CSV_UNEXPECTED_QUOTE"],
    ['id,name\na,"closed"extra', "CSV_AFTER_QUOTE"], ["id,name\na,b,c", "CSV_COLUMN_COUNT"], ["id,name\na", "CSV_COLUMN_COUNT"],
    ["id,name\na,\u0000", "CSV_CONTROL_CHARACTER"], ["id,name\na,\u0001", "CSV_CONTROL_CHARACTER"],
    ["", "CSV_EMPTY"], ["id,name\n", "CSV_NO_ROWS"],
  ];
  for (const [csv, code] of cases) assert.throws(() => parseImportCsv(Buffer.from(csv)), new RegExp(code), csv);
  assert.throws(() => parseImportCsv(Buffer.from([0xc3, 0x28])), /CSV_INVALID_UTF8/);
});

test("CSV limits bound bytes, rows, columns, headers and cells", () => {
  assert.throws(() => parseImportCsv(Buffer.alloc(IMPORT_LIMITS.maxBytes + 1, 97)), /CSV_FILE_TOO_LARGE/);
  assert.throws(() => parseImportCsv(Buffer.from("id\n" + Array.from({ length: IMPORT_LIMITS.maxRows + 1 }, (_, i) => String(i)).join("\n"))), /CSV_TOO_MANY_ROWS/);
  assert.throws(() => parseImportCsv(Buffer.from(Array.from({ length: IMPORT_LIMITS.maxColumns + 1 }, (_, i) => `c${i}`).join(",") + "\n")), /CSV_TOO_MANY_COLUMNS/);
  assert.throws(() => parseImportCsv(Buffer.from("x".repeat(IMPORT_LIMITS.maxHeaderLength + 1) + "\na")), /CSV_HEADER_TOO_LONG/);
  assert.throws(() => parseImportCsv(Buffer.from('id\n"' + "x".repeat(IMPORT_LIMITS.maxCellLength + 1) + '"')), /CSV_CELL_TOO_LONG/);
  assert.equal(parseImportCsv(Buffer.from("id\n" + "x".repeat(IMPORT_LIMITS.maxCellLength))).rows.length, 1);
  assert.equal(parseImportCsv(Buffer.from("id\n" + Array.from({ length: IMPORT_LIMITS.maxRows }, (_, i) => String(i)).join("\n"))).rows.length, IMPORT_LIMITS.maxRows);
});
