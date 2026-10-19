type LinePlaceholderProps = { points: number; message: string };

const xFor = (index: number, count: number) => (count === 1 ? 180 : 14 + (index * 332) / (count - 1));
const yFor = (index: number) => 108 - (0.5 + 0.28 * Math.sin(index * 1.7 + 0.8)) * 78;

export function LineChartPlaceholder({ points, message }: LinePlaceholderProps) {
  const positions = Array.from({ length: points }, (_, index) => ({ x: xFor(index, points), y: yFor(index) }));
  return <div className="chart-placeholder">
    <svg className="demo-sparkline" viewBox="0 0 360 132" aria-hidden="true" focusable="false">
      <g className="demo-sparkline-grid">{[18, 48, 78, 108].map((y) => <line key={y} x1="14" x2="346" y1={y} y2={y} />)}</g>
      <path d="M14 108 H346" className="demo-sparkline-baseline" />
      {positions.length > 1 ? <polyline points={positions.map(({ x, y }) => `${x},${y}`).join(" ")} className="chart-placeholder-line" /> : null}
      {positions.map(({ x, y }, index) => <circle key={index} cx={x} cy={y} r="4" className="chart-placeholder-point" />)}
    </svg>
    <p className="chart-placeholder-message">{message}</p>
  </div>;
}

export function BarsPlaceholder({ rows }: { rows: number }) {
  return <>{Array.from({ length: rows }, (_, index) => <div className="demo-comparison-row" aria-hidden="true" key={index}><span className="chart-placeholder-label" /><span className="demo-comparison-track chart-placeholder-track" /><strong>—</strong></div>)}</>;
}
