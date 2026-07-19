import { redirect } from "next/navigation";
import { parseExperienceState } from "@/domain/orbit/experience-state";
import { QuietOrbitShell } from "@/features/orbit/components/QuietOrbitShell";
import { calendarOAuthCallbackContinuation } from "@/server/connectors/google-calendar/http";
import { buildOrbitSnapshot } from "@/server/context/buildOrbitSnapshot";

export const dynamic = "force-dynamic";

interface HomePageProps {
  searchParams: Promise<{
    code?: string | string[];
    context?: string;
    error?: string | string[];
    state?: string | string[];
  }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { code, context, error, state } = await searchParams;
  const callbackContinuation = calendarOAuthCallbackContinuation({
    code,
    error,
    state,
  });
  if (callbackContinuation) redirect(callbackContinuation);

  const snapshot = await buildOrbitSnapshot({ contextPreference: context });

  return (
    <QuietOrbitShell
      snapshot={snapshot}
      initialState={parseExperienceState(
        typeof state === "string" ? state : undefined,
      )}
    />
  );
}
