import { buildOrbitSnapshot } from "@/server/context/buildOrbitSnapshot";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const contextPreference = new URL(request.url).searchParams.get("context");
  const snapshot = await buildOrbitSnapshot({
    contextPreference: contextPreference ?? undefined,
  });

  return Response.json(snapshot, {
    headers: {
      "cache-control": "no-store",
    },
  });
}
