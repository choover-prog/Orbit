export function OrbitConstellation() {
  return (
    <g className="constellation-shape">
      <path
        className="presence-link"
        d="M 21 59 C 34 68 48 64 58 50 C 66 39 75 35 84 39 M 30 31 C 39 39 48 45 58 50 M 58 50 C 66 59 70 69 72 78"
      />
      <circle
        className="presence-particle particle-one"
        cx="21"
        cy="59"
        r="3.2"
      />
      <circle
        className="presence-particle particle-two"
        cx="30"
        cy="31"
        r="2.5"
      />
      <circle
        className="presence-particle particle-three"
        cx="58"
        cy="50"
        r="4.2"
      />
      <circle
        className="presence-particle particle-four"
        cx="84"
        cy="39"
        r="3.2"
      />
      <circle
        className="presence-particle particle-five"
        cx="72"
        cy="78"
        r="2.7"
      />
      <circle
        className="presence-spark constellation-spark"
        cx="44"
        cy="73"
        r="1.8"
      />
    </g>
  );
}
