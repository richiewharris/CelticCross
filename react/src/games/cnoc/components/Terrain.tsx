// The mound seen from above: low ground, a raised slope, and the stone summit cross.
export function Terrain() {
  const u = 100;
  const cross = `M${3 * u} ${2 * u}h${u}v${u}h${u}v${u}h-${u}v${u}h-${u}v-${u}h-${u}v-${u}h${u}z`;
  return (
    <svg className="terrain" viewBox="0 0 700 700" aria-hidden="true">
      <defs>
        <filter id="cnoc-drop" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="5" dy="7" stdDeviation="4" floodColor="#000" floodOpacity=".38" /></filter>
        <pattern id="cnoc-grass" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M3 11 l2 -5 M9 12 l1 -4" stroke="#000" strokeOpacity=".08" strokeWidth="1.4" /></pattern>
      </defs>
      <rect width="700" height="700" fill="url(#cnoc-grass)" />
      <g filter="url(#cnoc-drop)"><rect x={u} y={u} width={5 * u} height={5 * u} rx="10" fill="var(--slope)" /></g>
      <rect x={u} y={u} width={5 * u} height={5 * u} rx="10" fill="url(#cnoc-grass)" />
      <g filter="url(#cnoc-drop)"><path d={cross} fill="var(--summit)" /></g>
      <path d={cross} fill="none" stroke="#fff" strokeOpacity=".25" strokeWidth="3" />
    </svg>
  );
}
