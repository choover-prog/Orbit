export function OrbitTrail() {
  return (
    <g className="trail-shape">
      <path
        className="presence-path presence-conversation-path"
        d="M 19 67 C 31 28 61 19 80 38"
      />
      <path
        className="presence-tail presence-speaking-tail"
        d="M 80 39 C 61 20 31 30 20 68"
      />
      <path className="presence-trail-echo" d="M 27 73 C 41 42 63 34 78 43" />
      <g className="presence-orbiter">
        <circle
          className="presence-satellite presence-trail-tip"
          cx="80"
          cy="39"
          r="4.5"
        />
      </g>
    </g>
  );
}
