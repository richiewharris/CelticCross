// The big hill seen from above: low ground, two slopes, the stone summit cross and the cairn.
export function Terrain() {
  const u = 100;
  const cross = `M${4 * u} ${3 * u}h${u}v${u}h${u}v${u}h-${u}v${u}h-${u}v-${u}h-${u}v-${u}h${u}z`;
  return (
    <svg className="terrain" viewBox="0 0 900 900" aria-hidden="true">
      <defs>
        <filter id="mor-drop" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="5" dy="7" stdDeviation="4" floodColor="#000" floodOpacity=".38" /></filter>
        <pattern id="mor-grass" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M3 11 l2 -5 M9 12 l1 -4" stroke="#000" strokeOpacity=".08" strokeWidth="1.4" /></pattern>
      </defs>
      <rect width="900" height="900" fill="url(#mor-grass)" />
      <g filter="url(#mor-drop)"><rect x={u} y={u} width={7 * u} height={7 * u} rx="10" fill="var(--slope)" /></g>
      <rect x={u} y={u} width={7 * u} height={7 * u} rx="10" fill="url(#mor-grass)" />
      <g filter="url(#mor-drop)"><rect x={2 * u} y={2 * u} width={5 * u} height={5 * u} rx="10" fill="var(--slope2)" /></g>
      <rect x={2 * u} y={2 * u} width={5 * u} height={5 * u} rx="10" fill="url(#mor-grass)" />
      <g filter="url(#mor-drop)"><path d={cross} fill="var(--summit)" /></g>
      <path d={cross} fill="none" stroke="#fff" strokeOpacity=".25" strokeWidth="3" />
      <circle cx="450" cy="450" r="40" fill="none" stroke="var(--cairn)" strokeWidth="5" strokeDasharray="10 7" />
    </svg>
  );
}
