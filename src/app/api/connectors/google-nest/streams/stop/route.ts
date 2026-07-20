import { getConnectorRegistry } from "@/server/connectors/registry";
import { localJson } from "../../route-utils";
export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<Response> {
  const parsed = await localJson(request);
  if (!parsed.ok) return parsed.response;
  const { sessionId } = parsed.value;
  if (typeof sessionId !== "string" || sessionId.length > 128)
    return Response.json({ error: "invalid_stream_session" }, { status: 400 });
  const gateway = getConnectorRegistry().nest;
  await gateway.stopStream(sessionId).catch(() => undefined);
  return Response.json(
    { audit: gateway.auditSnapshot() },
    { headers: { "cache-control": "no-store" } },
  );
}
