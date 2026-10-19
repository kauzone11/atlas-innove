import { Topo } from "@/components/brand/topo";
import type { ProfileCoverPreset } from "@/lib/profiles/cover-presets";

export function profileCoverStyleClass(preset: ProfileCoverPreset) {
  return `profile-cover-style-${preset.toLowerCase()}`;
}

export function ProfileCoverArt({ preset }: { preset: ProfileCoverPreset }) {
  if (preset === "ATLAS") return <span className="social-cover-geometry" />;
  if (preset === "CONTOUR") return <Topo seed={5} n={12} className="social-cover-topo" />;
  return null;
}
