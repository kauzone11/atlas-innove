export const IMPORT_LIMITS = {
  maxBytes: 2 * 1024 * 1024,
  maxRows: 1000,
  maxColumns: 64,
  maxCellLength: 4000,
  maxHeaderLength: 120,
  pageSize: 20,
  writeChunkSize: 100,
  schemaVersion: 1,
} as const;
