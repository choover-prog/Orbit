import { useId } from "react";

export function OrbitMorph() {
  const id = useId().replace(/:/g, "");
  const body = `${id}-morph-body`;
  const pulse = `${id}-morph-pulse`;

  return (
    <g className="liquid-shape morph-shape">
      <defs>
        <radialGradient id={body} cx="50%" cy="48%" r="62%">
          <stop offset="0" stopColor="#fffefa" stopOpacity="0.86" />
          <stop offset="0.45" stopColor="#edf2ef" stopOpacity="0.7" />
          <stop offset="0.72" stopColor="#4b4a45" stopOpacity="0.56" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.24" />
        </radialGradient>
        <radialGradient id={pulse} cx="50%" cy="50%" r="50%">
          <stop
            offset="0"
            stopColor="var(--liquid-signal-b)"
            stopOpacity="0.32"
          />
          <stop
            offset="0.38"
            stopColor="var(--liquid-signal-a)"
            stopOpacity="0.18"
          />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse className="liquid-shadow" cx="52" cy="78" rx="26" ry="4" />
      <path
        className="liquid-body morph-body"
        d="M 28 30 C 42 17 58 25 58 40 C 76 32 90 47 83 63 C 75 80 55 70 51 57 C 42 77 22 73 19 56 C 17 44 21 36 28 30 Z"
        fill={`url(#${body})`}
      />
      <path
        className="liquid-rim"
        d="M 30 33 C 43 23 56 29 55 43 C 70 35 82 47 76 61 C 70 72 56 65 52 54 C 45 68 29 69 24 56 C 21 48 24 38 30 33 Z"
      />
      <path className="liquid-glint" d="M 31 36 C 42 28 54 30 58 40" />
      <path
        className="liquid-signal liquid-signal-warm"
        d="M 23 53 C 31 42 42 38 55 43"
      />
      <path
        className="liquid-signal liquid-signal-cool"
        d="M 52 55 C 61 68 74 68 81 58"
      />
      <path className="liquid-tether" d="M 66 42 C 74 36 80 34 86 35" />
      <g className="liquid-notification">
        <circle className="liquid-bead" cx="86" cy="34" r="5.8" />
        <path className="liquid-bead-signal" d="M 82 35 C 85 39 89 36 91 32" />
      </g>
      <g className="liquid-pulse-field">
        <path
          className="liquid-pulse liquid-pulse-outer"
          d="M 37 42 C 47 35 63 39 68 50 C 74 63 60 74 46 68 C 34 63 28 51 37 42 Z"
          fill={`url(#${pulse})`}
        />
        <path
          className="liquid-pulse liquid-pulse-inner"
          d="M 42 47 C 50 41 61 44 64 52 C 67 62 57 68 48 64 C 40 60 36 52 42 47 Z"
        />
      </g>
    </g>
  );
}
