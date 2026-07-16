export function OrbitPulse() {
  return (
    <g className="pulse-shape">
      <path
        className="presence-pulse presence-pulse-outer"
        d="M 50 17 C 70 17 84 32 82 52 C 80 72 65 84 47 83 C 28 82 16 68 18 49 C 20 30 32 18 50 17 Z"
      />
      <ellipse
        className="presence-pulse presence-pulse-inner"
        cx="49"
        cy="50"
        rx="21"
        ry="19"
      />
      <circle
        className="presence-core presence-warm-core"
        cx="49"
        cy="50"
        r="9"
      />
    </g>
  );
}
