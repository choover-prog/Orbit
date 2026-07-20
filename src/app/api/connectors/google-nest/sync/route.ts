import { getConnectorRegistry } from "@/server/connectors/registry";
import { nestRedirect } from "@/server/connectors/google-nest/http";
import {
  forbiddenMutationResponse,
  localMutationRejectionReason,
} from "@/server/http/same-origin";
export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<Response> {
  const rejection = localMutationRejectionReason(request);
  if (rejection) return forbiddenMutationResponse(rejection);
  try {
    const state = await getConnectorRegistry().nest.read(new Date(), true);
    return nestRedirect(
      request,
      state.status === "fresh" ? "synced" : "failed",
    );
  } catch {
    return nestRedirect(request, "failed");
  }
}
