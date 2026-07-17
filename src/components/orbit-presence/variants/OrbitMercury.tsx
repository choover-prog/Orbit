import { useId } from "react";

export function OrbitMercury() {
  const id = useId().replace(/:/g, "");
  const metal = `${id}-mercury-metal`;
  const pulse = `${id}-mercury-pulse`;

  return (
    <g className="liquid-shape mercury-shape">
      <defs>
        <linearGradient id={metal} x1="16" y1="24" x2="84" y2="72">
          <stop offset="0" stopColor="#fffaf2" stopOpacity="0.2" />
          <stop
            offset="0.24"
            stopColor="var(--liquid-signal-a)"
            stopOpacity="0.62"
          />
          <stop offset="0.48" stopColor="#f8f5ee" stopOpacity="0.72" />
          <stop offset="0.72" stopColor="#162f28" stopOpacity="0.72" />
          <stop offset="1" stopColor="#fffaf2" stopOpacity="0.28" />
        </linearGradient>
        <radialGradient id={pulse} cx="50%" cy="50%" r="50%">
          <stop
            offset="0"
            stopColor="var(--liquid-signal-b)"
            stopOpacity="0.26"
          />
          <stop
            offset="0.45"
            stopColor="var(--liquid-signal-a)"
            stopOpacity="0.12"
          />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse className="liquid-shadow" cx="51" cy="76" rx="22" ry="4" />
      <path
        className="liquid-stream liquid-stream-shadow"
        d="M 28 64 C 19 49 29 28 50 24 C 73 20 88 37 80 53 C 73 67 53 72 42 62 C 34 54 38 42 49 37"
      />
      <path
        className="liquid-stream mercury-stream"
        d="M 28 64 C 19 49 29 28 50 24 C 73 20 88 37 80 53 C 73 67 53 72 42 62 C 34 54 38 42 49 37"
        stroke={`url(#${metal})`}
      />
      <path
        className="liquid-rim liquid-rim-bright"
        d="M 29 61 C 23 48 32 32 50 29 C 68 26 81 38 76 51 C 71 62 53 67 43 58"
      />
      <path
        className="liquid-glint liquid-glint-long"
        d="M 37 34 C 51 25 69 30 76 43"
      />
      <path
        className="liquid-signal liquid-signal-warm"
        d="M 28 62 C 34 70 49 68 61 60"
      />
      <path
        className="liquid-signal liquid-signal-cool"
        d="M 52 25 C 66 24 78 34 80 47"
      />
      <g className="liquid-pulse-field">
        <path
          className="liquid-pulse liquid-pulse-outer"
          d="M 39 45 C 48 37 63 40 68 51 C 73 64 58 72 45 66 C 34 60 31 51 39 45 Z"
          fill={`url(#${pulse})`}
        />
        <path
          className="liquid-pulse liquid-pulse-inner"
          d="M 44 49 C 51 43 60 45 63 53 C 66 61 56 67 48 63 C 40 59 38 53 44 49 Z"
        />
      </g>
    </g>
  );
}
