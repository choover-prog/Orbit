export function OrbitHybrid() {
  return (
    <g className="hybrid-shape">
      <ellipse
        className="presence-pulse presence-pulse-inner"
        cx="48"
        cy="52"
        rx="23"
        ry="21"
      />
      <path
        className="presence-path presence-conversation-path"
        d="M 17 58 C 26 30 54 19 77 34 C 90 43 88 60 76 71"
      />
      <path
        className="presence-tail presence-speaking-tail"
        d="M 24 68 C 39 83 65 80 78 60 C 84 50 83 40 77 34"
      />
      <g className="presence-orbiter">
        <circle className="presence-satellite" cx="78" cy="34" r="4.5" />
      </g>
      <circle className="presence-core-soft" cx="48" cy="52" r="18" />
      <circle
        className="presence-core presence-warm-core"
        cx="48"
        cy="52"
        r="9"
      />
    </g>
  );
}
