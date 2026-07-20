import { NextResponse } from "next/server";
import { getDeviceAtlasFixture } from "@/server/device-atlas/fixture";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getDeviceAtlasFixture(), {
    headers: {
      "cache-control": "no-store",
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    },
  });
}
