import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { parseExperienceState } from "@/domain/orbit/experience-state";
import { QuietOrbitShell } from "@/features/orbit/components/QuietOrbitShell";
import { calendarOAuthCallbackContinuation } from "@/server/connectors/google-calendar/http";
import { GOOGLE_CALENDAR_OAUTH_COOKIE_NAME } from "@/server/connectors/google-calendar/oauth-session";
import { gmailOAuthCallbackContinuation } from "@/server/connectors/gmail/http";
import { GMAIL_OAUTH_COOKIE_NAME } from "@/server/connectors/gmail/oauth-session";
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
  const hasOAuthCallback = code !== undefined || error !== undefined;
  if (hasOAuthCallback) {
    const cookieStore = await cookies();
    const ownsCalendarTransaction = cookieStore.has(
      GOOGLE_CALENDAR_OAUTH_COOKIE_NAME,
    );
    const ownsGmailTransaction = cookieStore.has(GMAIL_OAUTH_COOKIE_NAME);

    // The connector is selected only by its distinct HttpOnly transaction
    // cookie. Provider-controlled query values can never choose a vault.
    if (ownsCalendarTransaction !== ownsGmailTransaction) {
      const continuation = ownsGmailTransaction
        ? gmailOAuthCallbackContinuation({ code, error, state })
        : calendarOAuthCallbackContinuation({ code, error, state });
      if (continuation) redirect(continuation);
    }

    redirect(
      ownsCalendarTransaction && ownsGmailTransaction
        ? "/connections?calendar=invalid_callback&gmail=invalid_callback"
        : "/connections?gmail=invalid_callback",
    );
  }

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
