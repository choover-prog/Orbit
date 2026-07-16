export function OrbitConstellation() {
  return (
    <g className="constellation-shape">
      <path
        className="presence-link"
        d="M 26 40 L 49 50 L 70 31 M 49 50 L 70 69 M 49 50 L 29 71"
      />
      <circle className="presence-core" cx="49" cy="50" r="7" />
      <circle
        className="presence-particle particle-one"
        cx="26"
        cy="40"
        r="3"
      />
      <circle
        className="presence-particle particle-two"
        cx="70"
        cy="31"
        r="3.5"
      />
      <circle
        className="presence-particle particle-three"
        cx="70"
        cy="69"
        r="3"
      />
      <circle
        className="presence-particle particle-four"
        cx="29"
        cy="71"
        r="2.5"
      />
    </g>
  );
}
