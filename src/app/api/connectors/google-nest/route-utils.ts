import {
  forbiddenMutationResponse,
  localMutationRejectionReason,
} from "@/server/http/same-origin";

export async function localJson(
  request: Request,
): Promise<
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; response: Response }
> {
  const rejection = localMutationRejectionReason(request);
  if (rejection)
    return { ok: false, response: forbiddenMutationResponse(rejection) };
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > 96 * 1024)
    return {
      ok: false,
      response: Response.json({ error: "request_too_large" }, { status: 413 }),
    };
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return { ok: true, value: value as Record<string, unknown> };
  } catch {
    return {
      ok: false,
      response: Response.json({ error: "invalid_request" }, { status: 400 }),
    };
  }
}
