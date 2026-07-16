export function OrbitTrail() {
  return (
    <g className="trail-shape">
      <path
        className="presence-path presence-conversation-path"
        d="M 18 61 C 25 29 59 17 82 39 C 91 48 86 66 72 75"
      />
      <path
        className="presence-tail presence-speaking-tail"
        d="M 24 68 C 37 84 67 82 80 61 C 88 48 84 39 77 33"
      />
      <g className="presence-orbiter">
        <circle className="presence-satellite" cx="79" cy="34" r="4.5" />
      </g>
      <circle
        className="presence-core presence-trail-core"
        cx="49"
        cy="52"
        r="9"
      />
      <circle className="presence-core-soft" cx="49" cy="52" r="18" />
    </g>
  );
}
