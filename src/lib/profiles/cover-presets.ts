export const profileCoverPresets = ["ATLAS", "CONTOUR", "SIGNAL", "GRID"] as const;
export type ProfileCoverPreset = (typeof profileCoverPresets)[number];

export const profileCoverPresetLabels: Record<ProfileCoverPreset, string> = {
  ATLAS: "Atlas",
  CONTOUR: "Curvas",
  SIGNAL: "Sinal",
  GRID: "Malha",
};
