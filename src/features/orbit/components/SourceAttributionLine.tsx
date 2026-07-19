import type { SourceAttribution } from "@/domain/orbit/types";

interface SourceAttributionLineProps {
  attribution: SourceAttribution;
  className?: string;
}

export function SourceAttributionLine({
  attribution,
  className,
}: SourceAttributionLineProps) {
  return (
    <p className={className}>
      <a href={attribution.url} target="_blank" rel="noreferrer">
        {attribution.label}
      </a>{" "}
      ·{" "}
      <a href={attribution.licenseUrl} target="_blank" rel="noreferrer">
        {attribution.license}
      </a>
      {attribution.transformed ? " · transformed by Orbit" : ""}
    </p>
  );
}
