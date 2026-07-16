export function OrbitRibbon() {
  return (
    <g className="ribbon-shape">
      <path
        className="presence-ribbon presence-ribbon-back"
        d="M 20 68 C 34 79 50 68 49 54 C 48 40 59 26 78 30"
      />
      <path
        className="presence-ribbon presence-ribbon-front"
        d="M 27 65 C 41 73 58 63 55 48 C 53 38 63 30 75 32"
      />
      <path
        className="presence-ribbon presence-ribbon-flare"
        d="M 55 48 C 61 52 68 54 76 51"
      />
      <circle
        className="presence-spark ribbon-spark-one"
        cx="20"
        cy="68"
        r="2.8"
      />
      <circle
        className="presence-satellite ribbon-spark-two"
        cx="78"
        cy="30"
        r="4"
      />
    </g>
  );
}
