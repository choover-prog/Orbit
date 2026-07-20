import { getConnectorRegistry } from "@/server/connectors/registry";
import { localJson } from "../../route-utils";
export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<Response> {
  const parsed = await localJson(request);
  if (!parsed.ok) return parsed.response;
  const { planId, planHash } = parsed.value;
  if (
    typeof planId !== "string" ||
    typeof planHash !== "string" ||
    planId.length > 128 ||
    !/^[a-f0-9]{64}$/u.test(planHash)
  )
    return Response.json({ error: "invalid_approval" }, { status: 400 });
  try {
    const gateway = getConnectorRegistry().nest;
    const result = await gateway.approvePlan(planId, planHash);
    return Response.json(
      { result, audit: gateway.auditSnapshot() },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error: "approval_rejected",
        message:
          error instanceof Error ? error.message : "Approval was rejected.",
      },
      { status: 409 },
    );
  }
}
