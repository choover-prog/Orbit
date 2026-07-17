import { useId } from "react";

export function OrbitElastic() {
  const id = useId().replace(/:/g, "");
  const silk = `${id}-elastic-silk`;
  const pulse = `${id}-elastic-pulse`;

  return (
    <g className="liquid-shape elastic-shape">
      <defs>
        <linearGradient id={silk} x1="12" y1="68" x2="88" y2="34">
          <stop offset="0" stopColor="#ff4b3d" stopOpacity="0.56" />
          <stop offset="0.33" stopColor="#f7f1e8" stopOpacity="0.38" />
          <stop offset="0.58" stopColor="#191716" stopOpacity="0.4" />
          <stop offset="0.78" stopColor="#7f4bc6" stopOpacity="0.38" />
          <stop
            offset="1"
            stopColor="var(--liquid-signal-b)"
            stopOpacity="0.44"
          />
        </linearGradient>
        <radialGradient id={pulse} cx="50%" cy="51%" r="48%">
          <stop
            offset="0"
            stopColor="var(--liquid-signal-b)"
            stopOpacity="0.24"
          />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse className="liquid-shadow" cx="52" cy="77" rx="25" ry="4" />
      <path
        className="liquid-skin elastic-skin"
        d="M 17 57 C 21 36 42 28 54 43 C 63 55 78 30 87 48 C 96 67 72 78 57 65 C 44 54 27 76 18 63 C 16 61 16 59 17 57 Z"
        fill={`url(#${silk})`}
      />
      <path
        className="liquid-mesh"
        d="M 18 59 C 31 48 42 39 53 44 C 65 49 73 44 86 49"
      />
      <path
        className="liquid-mesh mesh-two"
        d="M 21 63 C 35 72 45 56 55 50 C 67 42 78 50 86 55"
      />
      <path
        className="liquid-rim"
        d="M 20 56 C 28 39 42 35 52 45 C 63 57 77 39 83 50 C 89 62 70 70 58 60 C 45 49 30 67 22 61"
      />
      <path
        className="liquid-signal liquid-signal-magenta"
        d="M 18 58 C 30 69 43 58 53 49"
      />
      <path
        className="liquid-signal liquid-signal-lime"
        d="M 55 46 C 66 56 76 53 86 49"
      />
      <path className="liquid-glint" d="M 30 41 C 43 34 55 40 60 49" />
      <g className="liquid-pulse-field">
        <path
          className="liquid-pulse liquid-pulse-outer"
          d="M 39 48 C 48 40 64 43 69 53 C 74 64 61 72 49 67 C 37 62 33 55 39 48 Z"
          fill={`url(#${pulse})`}
        />
        <path
          className="liquid-pulse liquid-pulse-inner"
          d="M 45 51 C 51 46 60 48 63 55 C 65 62 56 66 49 62 C 43 59 41 54 45 51 Z"
        />
      </g>
    </g>
  );
}
