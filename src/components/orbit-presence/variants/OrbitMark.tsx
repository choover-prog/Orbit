export function OrbitMark() {
  return (
    <g className="mark-shape">
      <path
        className="presence-ring presence-open-ring"
        d="M 72 27 C 87 40 88 61 73 75 C 58 90 34 86 23 69 C 13 53 18 32 34 23"
      />
      <circle
        className="presence-core presence-mark-core"
        cx="47"
        cy="51"
        r="5"
      />
      <g className="presence-satellite-group">
        <circle className="presence-satellite" cx="76" cy="29" r="4" />
      </g>
    </g>
  );
}
