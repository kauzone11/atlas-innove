export type ComparisonStatus = "READY" | "MISSING_OFFSET" | "AMBIGUOUS_OFFSET" | "UNMAPPED_METRIC" | "INCOMPATIBLE_METRIC";

export function resolveComparableWave<T extends { offsetMonths: number | null }>(waves: T[], offsetMonths: number): { status: ComparisonStatus; wave: T | null } {
  const matches = waves.filter((wave) => wave.offsetMonths !== null && wave.offsetMonths === offsetMonths);
  if (!matches.length) return { status: "MISSING_OFFSET", wave: null };
  if (matches.length !== 1) return { status: "AMBIGUOUS_OFFSET", wave: null };
  return { status: "READY", wave: matches[0] };
}

export function ambiguousOffsets(waves: { offsetMonths: number | null }[]): number[] {
  const counts = new Map<number, number>();
  for (const wave of waves) if (wave.offsetMonths !== null) counts.set(wave.offsetMonths, (counts.get(wave.offsetMonths) ?? 0) + 1);
  return [...counts].filter(([, count]) => count > 1).map(([offset]) => offset).sort((a, b) => a - b);
}
