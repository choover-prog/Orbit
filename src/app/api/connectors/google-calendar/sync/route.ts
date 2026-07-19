import { calendarConnectionsRedirect } from "@/server/connectors/google-calendar/http";
import { getConnectorRegistry } from "@/server/connectors/registry";
import {
  forbiddenMutationResponse,
  localMutationRejectionReason,
} from "@/server/http/same-origin";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const rejection = localMutationRejectionReason(request);
  if (rejection) return forbiddenMutationResponse(rejection);

  const state = await getConnectorRegistry().calendar.read(new Date(), {
    force: true,
  });
  return calendarConnectionsRedirect(
    request,
    state.status === "fresh"
      ? state.fromCache
        ? "current"
        : "synced"
      : "failed",
  );
}
