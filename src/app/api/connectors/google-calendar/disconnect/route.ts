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

  try {
    const result = await getConnectorRegistry().calendar.disconnect();
    return calendarConnectionsRedirect(
      request,
      result.providerRevoked ? "disconnected" : "local_only",
    );
  } catch {
    return calendarConnectionsRedirect(request, "failed");
  }
}
