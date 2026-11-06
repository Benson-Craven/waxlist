import "server-only";

import { NextResponse } from "next/server";

import {
  requireServerCapability,
  type ServerCapability,
} from "@/lib/capabilities/server";

export function disabledCapabilityResponse(capability: ServerCapability) {
  const result = requireServerCapability(capability);

  return result.ok
    ? null
    : NextResponse.json({ error: result.error }, { status: 404 });
}
