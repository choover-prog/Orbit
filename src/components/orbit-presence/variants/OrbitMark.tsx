export function OrbitMark() {
  return (
    <g className="mark-shape">
      <circle className="presence-ring" cx="50" cy="50" r="30" />
      <circle className="presence-center" cx="50" cy="50" r="4" />
      <circle className="presence-satellite" cx="73" cy="30" r="3.5" />
    </g>
  );
}
