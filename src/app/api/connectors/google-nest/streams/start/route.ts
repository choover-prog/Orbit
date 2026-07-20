import { getConnectorRegistry } from "@/server/connectors/registry";
import { localJson } from "../../route-utils";
export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<Response> {
  const parsed = await localJson(request);
  if (!parsed.ok) return parsed.response;
  const { deviceId, offerSdp } = parsed.value;
  if (typeof deviceId !== "string" || typeof offerSdp !== "string")
    return Response.json({ error: "invalid_stream_request" }, { status: 400 });
  try {
    const gateway = getConnectorRegistry().nest;
    const session = await gateway.startStream(deviceId, offerSdp);
    return Response.json(
      { session, audit: gateway.auditSnapshot() },
      {
        headers: {
          "cache-control": "no-store",
          "referrer-policy": "no-referrer",
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        error: "stream_unavailable",
        message:
          error instanceof Error
            ? error.message
            : "The live stream could not start.",
      },
      { status: 409 },
    );
  }
}
