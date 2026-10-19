import data from "@/lib/geo/ibge-municipalities.json";

export type BrazilianState = { uf: string; name: string; municipalities: string[] };

export const brazilianStates: BrazilianState[] = data.states;
export const brazilianStateNames = brazilianStates.map((state) => state.name);

export function municipalitiesOfState(stateName: string): string[] {
  return brazilianStates.find((state) => state.name === stateName)?.municipalities ?? [];
}
