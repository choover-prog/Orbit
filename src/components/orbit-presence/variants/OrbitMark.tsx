export function OrbitMark() {
  return (
    <g className="mark-shape">
      <path
        className="presence-ring presence-open-ring"
        d="M 69 24 C 84 33 89 50 82 65 C 75 80 58 88 42 83 C 26 78 17 63 20 48 C 22 37 29 29 39 24"
      />
      <path
        className="presence-mark-tick mark-tick-one"
        d="M 32 34 C 36 30 40 28 45 27"
      />
      <path
        className="presence-mark-tick mark-tick-two"
        d="M 73 72 C 69 76 64 78 59 79"
      />
      <g className="presence-satellite-group">
        <circle className="presence-satellite" cx="72" cy="26" r="4.3" />
      </g>
    </g>
  );
}
