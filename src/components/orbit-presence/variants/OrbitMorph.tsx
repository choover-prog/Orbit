import { useId } from "react";

export function OrbitMorph() {
  const id = useId().replace(/:/g, "");
  const metal = `${id}-morph-metal`;
  const underbelly = `${id}-morph-underbelly`;
  const rim = `${id}-morph-rim`;
  const pulse = `${id}-morph-pulse`;
  const pulseCore = `${id}-morph-pulse-core`;
  const warm = `${id}-morph-warm`;
  const cool = `${id}-morph-cool`;
  const bead = `${id}-morph-bead`;
  const texture = `${id}-morph-texture`;

  return (
    <g className="liquid-shape morph-shape">
      <defs>
        <radialGradient id={metal} cx="40%" cy="30%" r="84%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.98" />
          <stop offset="0.18" stopColor="#f7f2eb" stopOpacity="0.88" />
          <stop offset="0.38" stopColor="#d4cdc3" stopOpacity="0.74" />
          <stop offset="0.56" stopColor="#34312d" stopOpacity="0.64" />
          <stop offset="0.72" stopColor="#f29660" stopOpacity="0.36" />
          <stop offset="0.88" stopColor="#d7f7f4" stopOpacity="0.34" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.2" />
        </radialGradient>
        <radialGradient id={underbelly} cx="32%" cy="76%" r="78%">
          <stop offset="0" stopColor="#161412" stopOpacity="0.58" />
          <stop offset="0.38" stopColor="#4d4841" stopOpacity="0.34" />
          <stop offset="0.72" stopColor="#fff7ec" stopOpacity="0.18" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={rim} x1="12" x2="97" y1="28" y2="60">
          <stop offset="0" stopColor="#f7ffff" stopOpacity="0.88" />
          <stop offset="0.18" stopColor="#879391" stopOpacity="0.7" />
          <stop offset="0.38" stopColor="var(--liquid-signal-b)" />
          <stop offset="0.58" stopColor="#fff0df" />
          <stop offset="0.78" stopColor="var(--liquid-signal-a)" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.76" />
        </linearGradient>
        <radialGradient id={pulse} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.72" />
          <stop
            offset="0.34"
            stopColor="var(--liquid-signal-b)"
            stopOpacity="0.26"
          />
          <stop
            offset="0.68"
            stopColor="var(--liquid-signal-a)"
            stopOpacity="0.16"
          />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={pulseCore} cx="42%" cy="35%" r="62%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.82" />
          <stop offset="0.42" stopColor="var(--liquid-signal-b)" />
          <stop offset="1" stopColor="var(--liquid-signal-a)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={warm} x1="20" x2="97" y1="69" y2="36">
          <stop offset="0" stopColor="var(--liquid-signal-b)" />
          <stop offset="0.34" stopColor="#fff7dc" />
          <stop offset="0.66" stopColor="var(--liquid-signal-a)" />
          <stop offset="1" stopColor="#ff2f74" />
        </linearGradient>
        <linearGradient id={cool} x1="20" x2="77" y1="31" y2="79">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.22" stopColor="var(--liquid-signal-b)" />
          <stop offset="0.58" stopColor="#ffffff" />
          <stop offset="1" stopColor="var(--liquid-signal-b)" />
        </linearGradient>
        <filter id={texture} x="-18%" y="-18%" width="136%" height="136%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.018 0.052"
            numOctaves="2"
            seed="7"
            result="liquidNoise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="liquidNoise"
            scale="1.35"
            xChannelSelector="R"
            yChannelSelector="G"
            result="warped"
          />
          <feSpecularLighting
            in="liquidNoise"
            surfaceScale="5.5"
            specularConstant="0.68"
            specularExponent="20"
            lightingColor="#ffffff"
            result="specular"
          >
            <fePointLight x="-32" y="-48" z="96" />
          </feSpecularLighting>
          <feComposite
            in="specular"
            in2="warped"
            operator="in"
            result="specularMasked"
          />
          <feBlend in="warped" in2="specularMasked" mode="screen" />
        </filter>
        <radialGradient id={bead} cx="35%" cy="30%" r="68%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.34" stopColor="#f5eee4" />
          <stop offset="0.68" stopColor="#2c2927" stopOpacity="0.72" />
          <stop
            offset="1"
            stopColor="var(--liquid-signal-a)"
            stopOpacity="0.58"
          />
        </radialGradient>
      </defs>
      <ellipse className="liquid-shadow" cx="51" cy="80" rx="34" ry="5.2" />
      <path
        className="liquid-tendril-body"
        d="M 61 47 C 72 49 82 40 94 38 C 87 46 78 55 63 55"
        stroke={`url(#${rim})`}
      />
      <path
        className="liquid-body morph-body"
        d="M 23 34 C 20 20 37 16 43 28 C 52 18 68 21 68 35 C 69 45 82 41 93 39 C 91 50 77 58 66 55 C 68 69 55 80 45 69 C 35 78 18 68 24 55 C 12 49 13 37 23 34 Z"
        fill={`url(#${metal})`}
        filter={`url(#${texture})`}
      />
      <path
        className="liquid-morph-underbelly"
        d="M 24 56 C 33 64 42 57 48 48 C 55 58 63 64 73 58 C 69 72 56 80 46 68 C 36 78 20 69 24 56 Z"
        fill={`url(#${underbelly})`}
      />
      <path
        className="liquid-center-void"
        d="M 35 41 C 43 32 58 33 63 44 C 69 57 57 68 44 63 C 32 59 27 49 35 41 Z"
      />
      <g className="liquid-pulse-field">
        <path
          className="liquid-pulse liquid-pulse-outer"
          d="M 38 45 C 47 38 59 41 63 51 C 67 61 56 68 46 64 C 36 60 31 52 38 45 Z"
          fill={`url(#${pulse})`}
        />
        <path
          className="liquid-pulse liquid-pulse-inner"
          d="M 44 48 C 50 43 59 46 60 53 C 62 60 54 64 48 61 C 42 58 39 52 44 48 Z"
          fill={`url(#${pulseCore})`}
        />
        <path
          className="liquid-pulse-ring liquid-pulse-ring-one"
          d="M 36 50 C 39 40 52 35 61 41 C 70 47 69 62 59 68 C 48 75 34 64 36 50 Z"
        />
        <path
          className="liquid-pulse-ring liquid-pulse-ring-two"
          d="M 42 51 C 45 45 53 42 59 47 C 64 52 63 60 56 64 C 48 68 40 59 42 51 Z"
        />
      </g>
      <path
        className="liquid-rim"
        d="M 23 34 C 20 20 37 16 43 28 C 52 18 68 21 68 35 C 69 45 82 41 93 39 C 91 50 77 58 66 55 C 68 69 55 80 45 69 C 35 78 18 68 24 55 C 12 49 13 37 23 34 Z"
        stroke={`url(#${rim})`}
      />
      <path
        className="liquid-rim liquid-rim-bright"
        d="M 26 34 C 33 23 41 26 45 32 C 51 25 64 25 64 36"
      />
      <path
        className="liquid-reflection liquid-reflection-dark"
        d="M 25 39 C 31 27 39 29 44 35 C 53 26 65 29 65 41 C 67 50 76 50 86 44"
      />
      <path
        className="liquid-reflection liquid-reflection-light"
        d="M 22 52 C 33 58 42 51 48 42 C 55 52 65 56 76 52"
      />
      <path
        className="liquid-reflection liquid-reflection-foil"
        d="M 29 63 C 38 68 45 61 50 54 C 57 66 67 65 75 57"
      />
      <path className="liquid-glint" d="M 26 31 C 35 22 43 26 47 33" />
      <path
        className="liquid-glint liquid-glint-long"
        d="M 59 47 C 70 49 80 43 92 39"
      />
      <path
        className="liquid-signal liquid-signal-gradient-cool"
        d="M 27 35 C 34 28 42 32 47 39 C 53 29 63 29 64 40 C 65 49 70 53 77 52"
        stroke={`url(#${cool})`}
      />
      <path
        className="liquid-signal liquid-signal-gradient-warm"
        d="M 26 58 C 37 67 46 58 52 49 C 60 55 72 52 94 39"
        stroke={`url(#${warm})`}
      />
      <path className="liquid-tether" d="M 72 50 C 80 45 88 41 95 39" />
      <g className="liquid-notification">
        <circle
          className="liquid-bead"
          cx="94"
          cy="39"
          r="6.6"
          fill={`url(#${bead})`}
        />
        <circle className="liquid-bead-core" cx="94" cy="39" r="2.4" />
        <path className="liquid-bead-signal" d="M 89 41 C 92 45 97 42 99 37" />
      </g>
    </g>
  );
}
