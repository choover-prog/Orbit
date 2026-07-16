export function OrbitHybrid() {
  return (
    <g className="hybrid-shape">
      <circle
        className="presence-pulse presence-pulse-inner"
        cx="50"
        cy="50"
        r="23"
      />
      <ellipse className="presence-path" cx="50" cy="50" rx="34" ry="27" />
      <path className="presence-tail" d="M 20 61 A 34 27 0 0 0 72 30" />
      <g className="presence-orbiter">
        <circle className="presence-satellite" cx="82" cy="41" r="4" />
      </g>
      <circle className="presence-core" cx="50" cy="50" r="8" />
    </g>
  );
}
