import { parseExperienceState } from "@/domain/orbit/experience-state";
import { QuietOrbitShell } from "@/features/orbit/components/QuietOrbitShell";

interface HomePageProps {
  searchParams: Promise<{ state?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { state } = await searchParams;
  return <QuietOrbitShell initialState={parseExperienceState(state)} />;
}
