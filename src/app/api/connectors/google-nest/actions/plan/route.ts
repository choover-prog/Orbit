import { getConnectorRegistry } from "@/server/connectors/registry";
import type { HomeCommandRequest } from "@/server/connectors/google-nest";
import { localJson } from "../../route-utils";

export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<Response> {
  const parsed = await localJson(request);
  if (!parsed.ok) return parsed.response;
  const { deviceId, capability, parameters } = parsed.value;
  if (
    typeof deviceId !== "string" ||
    deviceId.length > 128 ||
    !parameters ||
    typeof parameters !== "object" ||
    Array.isArray(parameters)
  )
    return Response.json({ error: "invalid_plan" }, { status: 400 });
  let input: HomeCommandRequest;
  const values = parameters as Record<string, unknown>;
  if (
    capability === "thermostat.set_mode" &&
    ["heat", "cool", "heat_cool", "off"].includes(String(values.mode))
  ) {
    input = {
      deviceId,
      capability,
      parameters: {
        mode: values.mode as "heat" | "cool" | "heat_cool" | "off",
      },
    };
  } else if (capability === "thermostat.set_temperature") {
    input = {
      deviceId,
      capability,
      parameters: {
        ...(typeof values.heatCelsius === "number"
          ? { heatCelsius: values.heatCelsius }
          : {}),
        ...(typeof values.coolCelsius === "number"
          ? { coolCelsius: values.coolCelsius }
          : {}),
      },
    };
  } else if (
    capability === "fan.set_timer" &&
    (values.timerMode === "on" || values.timerMode === "off")
  ) {
    input = {
      deviceId,
      capability,
      parameters: {
        timerMode: values.timerMode,
        ...(typeof values.durationSeconds === "number"
          ? { durationSeconds: values.durationSeconds }
          : {}),
      },
    };
  } else return Response.json({ error: "invalid_plan" }, { status: 400 });
  try {
    const gateway = getConnectorRegistry().nest;
    return Response.json(
      { plan: gateway.createPlan(input), audit: gateway.auditSnapshot() },
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
        error: "plan_rejected",
        message:
          error instanceof Error
            ? error.message
            : "The device plan was rejected.",
      },
      { status: 409 },
    );
  }
}
