export function OrbitConstellation() {
  return (
    <g className="constellation-shape">
      <path
        className="presence-link"
        d="M 27 39 C 38 45 42 48 49 51 C 58 45 64 38 73 32 M 49 51 C 58 58 64 65 72 70 M 49 51 C 41 60 35 67 29 73"
      />
      <circle
        className="presence-core presence-constellation-core"
        cx="49"
        cy="51"
        r="9"
      />
      <circle
        className="presence-particle particle-one"
        cx="26"
        cy="40"
        r="3.5"
      />
      <circle
        className="presence-particle particle-two"
        cx="70"
        cy="31"
        r="4"
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
