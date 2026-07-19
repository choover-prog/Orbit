import { parseExperienceState } from "@/domain/orbit/experience-state";
import { QuietOrbitShell } from "@/features/orbit/components/QuietOrbitShell";
import { buildOrbitSnapshot } from "@/server/context/buildOrbitSnapshot";

export const dynamic = "force-dynamic";

interface HomePageProps {
  searchParams: Promise<{ state?: string; context?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { context, state } = await searchParams;
  const snapshot = await buildOrbitSnapshot({ contextPreference: context });

  return (
    <QuietOrbitShell
      snapshot={snapshot}
      initialState={parseExperienceState(state)}
    />
  );
}
