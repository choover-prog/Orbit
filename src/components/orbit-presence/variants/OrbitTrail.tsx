export function OrbitTrail() {
  return (
    <g className="trail-shape">
      <ellipse className="presence-path" cx="50" cy="50" rx="33" ry="25" />
      <path className="presence-tail" d="M 16 50 A 34 25 0 0 1 50 25" />
      <g className="presence-orbiter">
        <circle className="presence-satellite" cx="83" cy="50" r="4" />
      </g>
      <circle className="presence-center" cx="50" cy="50" r="5" />
    </g>
  );
}
