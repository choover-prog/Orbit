export function OrbitPulse() {
  return (
    <g className="pulse-shape">
      <circle
        className="presence-pulse presence-pulse-outer"
        cx="50"
        cy="50"
        r="31"
      />
      <circle
        className="presence-pulse presence-pulse-inner"
        cx="50"
        cy="50"
        r="20"
      />
      <circle className="presence-core" cx="50" cy="50" r="9" />
    </g>
  );
}
