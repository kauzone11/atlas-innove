/** Contour lines: the graphic signature of Atlas Innove. Deterministic per seed so server and client markup match. */
export function Topo({ seed = 1, n = 14, w = 900, h = 500, cx, cy, className = "topo" }: { seed?: number; n?: number; w?: number; h?: number; cx?: number; cy?: number; className?: string }) {
  const centerX = cx ?? w * 0.7;
  const centerY = cy ?? h * 0.4;
  const step = Math.max(w, h) / (n * 1.55);
  const phase = (i: number) => (((seed * 9301 + i * 49297) % 233280) / 233280) * 6.283;
  const p = [phase(1), phase(2), phase(3), phase(4)];
  const paths: Array<{ d: string; opacity: number }> = [];
  for (let k = 1; k <= n; k++) {
    const radius = k * step;
    let d = "";
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * 6.2832;
      const wobble = 1 + 0.13 * Math.sin(2 * a + p[0] + k * 0.11) + 0.08 * Math.sin(3 * a + p[1] - k * 0.07) + 0.045 * Math.sin(5 * a + p[2] + k * 0.2) + 0.025 * Math.sin(8 * a + p[3]);
      d += `${i ? "L" : "M"}${(centerX + radius * wobble * Math.cos(a) * 1.25).toFixed(1)} ${(centerY + radius * wobble * Math.sin(a) * 0.85).toFixed(1)} `;
    }
    paths.push({ d: `${d}Z`, opacity: Math.max(0.22, 0.95 - k * 0.045) });
  }
  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice" fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paths.map((path, index) => <path key={index} d={path.d} strokeOpacity={path.opacity.toFixed(2)} />)}
    </svg>
  );
}
