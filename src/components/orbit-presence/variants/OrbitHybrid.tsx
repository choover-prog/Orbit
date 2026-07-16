export function OrbitHybrid() {
  return (
    <g className="hybrid-shape">
      <path
        className="presence-pulse presence-pulse-inner"
        d="M 24 44 C 31 25 56 22 69 35 C 82 49 67 70 49 70 C 31 70 18 59 24 44 Z"
      />
      <path
        className="presence-path presence-conversation-path"
        d="M 24 68 C 42 82 74 70 78 45"
      />
      <path
        className="presence-tail presence-speaking-tail"
        d="M 78 44 C 75 69 43 82 24 68"
      />
      <g className="presence-orbiter">
        <circle className="presence-satellite" cx="78" cy="44" r="4.3" />
      </g>
      <path className="presence-glint" d="M 31 59 C 43 56 55 50 65 41" />
    </g>
  );
}
