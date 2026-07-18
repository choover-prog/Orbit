export function OrbitPulse() {
  return (
    <g className="pulse-shape">
      <path
        className="presence-pulse presence-pulse-outer"
        d="M 30 30 C 43 17 69 21 78 40 C 88 61 68 82 46 77 C 25 73 16 45 30 30 Z"
      />
      <path
        className="presence-pulse presence-pulse-inner"
        d="M 35 38 C 46 27 65 31 70 45 C 76 60 61 71 47 67 C 32 63 26 47 35 38 Z"
      />
      <path className="presence-glint" d="M 34 58 C 43 55 52 50 60 42" />
      <circle
        className="presence-satellite pulse-spark"
        cx="70"
        cy="35"
        r="3.2"
      />
    </g>
  );
}
