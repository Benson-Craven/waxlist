import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { resolveAuthenticatedOwner } from "@/lib/auth/owner";
import { disabledCapabilityResponse } from "@/lib/capabilities/response";
import {
  getApiCacheEnv,
  getDiscogsEnv,
  getDiscogsMatchSecurityEnv,
} from "@/lib/config";
import { DiscogsCatalogueError } from "@/lib/discogs/catalogue-client";
import {
  normalizePressingEvidence,
  type PressingEvidence,
} from "@/lib/pressing-detective/matching";
import {
  createPressingInvestigation,
  listPressingInvestigations,
  PressingInvestigationNotFoundError,
  type PressingInvestigationInputSource,
  updatePressingInvestigation,
} from "@/lib/pressing-proof/investigations-server";
import { PressingCatalogueInputError } from "@/lib/pressing-proof/server";
import { readLimitedJsonRequest } from "@/lib/security/limited-json";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const INPUT_SOURCES = new Set<PressingInvestigationInputSource>([
  "camera_barcode",
  "manual_barcode",
  "manual_search",
  "manual_discogs_id",
]);

async function authenticatedOwner() {
  const resolved = await resolveAuthenticatedOwner();

  if (resolved.ok) {
    return resolved;
  }

  return NextResponse.json(
    {
      error: {
        code: resolved.code,
        message: resolved.message,
      },
    },
    { status: resolved.code === "auth_required" ? 401 : 500 },
  );
}

function positiveInteger(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function ownerKey(userId: string) {
  return createHash("sha256")
    .update(userId)
    .digest("base64url")
    .slice(0, 20);
}

function providerRateLimit(
  userId: string,
  securityEnv: {
    rateLimitMaxRequests: number;
    rateLimitWindowMs: number;
  },
) {
  const result = checkRateLimit({
    key: `pressing-investigations:${ownerKey(userId)}`,
    limit: securityEnv.rateLimitMaxRequests,
    windowMs: securityEnv.rateLimitWindowMs,
  });

  return result.ok
    ? null
    : NextResponse.json(
        {
          error: {
            code: "pressing_investigation_rate_limited",
            message: "Too many investigation checks. Please wait and retry.",
            retryAfterSeconds: result.retryAfterSeconds,
          },
        },
        {
          status: 429,
          headers: { "Retry-After": String(result.retryAfterSeconds) },
        },
      );
}

function pressingInvestigationError(error: unknown) {
  if (error instanceof PressingCatalogueInputError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof DiscogsCatalogueError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          retryAfterSeconds: error.retryAfterSeconds,
        },
      },
      {
        status: error.status || 502,
        headers: error.retryAfterSeconds
          ? { "Retry-After": String(error.retryAfterSeconds) }
          : undefined,
      },
    );
  }

  return NextResponse.json(
    {
      error: {
        code: "pressing_investigation_failed",
        message:
          "The pressing investigation could not be saved. No collection record was changed.",
      },
    },
    { status: 500 },
  );
}

function evidenceFrom(value: unknown): PressingEvidence {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  const optionalText = (key: string) =>
    typeof record[key] === "string"
      ? String(record[key]).trim().slice(0, 300)
      : undefined;

  return normalizePressingEvidence({
    barcode: optionalText("barcode"),
    catalogNumber: optionalText("catalogNumber"),
    country: optionalText("country"),
    label: optionalText("label"),
    format: optionalText("format"),
    matrixRunout: optionalText("matrixRunout"),
    identifierText: optionalText("identifierText"),
    year: positiveInteger(record.year),
  });
}

function catalogueConfiguration() {
  const [discogsEnv, cacheEnv, securityEnv] = [
    getDiscogsEnv(),
    getApiCacheEnv(),
    getDiscogsMatchSecurityEnv(),
  ];

  if (!discogsEnv.ok || !cacheEnv.ok || !securityEnv.ok) {
    const failed = [discogsEnv, cacheEnv, securityEnv].find(
      (result) => !result.ok,
    );
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: {
            code: "pressing_investigation_configuration_error",
            message:
              failed?.message ?? "Pressing investigations are not configured.",
            missing: failed?.missing ?? [],
          },
        },
        { status: 500 },
      ),
    };
  }

  return {
    ok: true as const,
    discogsEnv,
    cacheEnv,
    securityEnv,
  };
}

async function bodyFrom(request: Request, maxBytes: number) {
  const result = await readLimitedJsonRequest(request, maxBytes);

  if (!result.ok) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: { code: result.code, message: result.message } },
        { status: result.status },
      ),
    };
  }

  return {
    ok: true as const,
    body:
      result.value && typeof result.value === "object"
        ? (result.value as Record<string, unknown>)
        : {},
  };
}

export async function GET() {
  const disabled = disabledCapabilityResponse("pressingProof");
  if (disabled) return disabled;

  const resolved = await authenticatedOwner();
  if (resolved instanceof NextResponse) return resolved;

  const investigations = await listPressingInvestigations(resolved.owner);
  return NextResponse.json({ investigations });
}

export async function POST(request: Request) {
  const disabled = disabledCapabilityResponse("pressingProof");
  if (disabled) return disabled;

  const resolved = await authenticatedOwner();
  if (resolved instanceof NextResponse) return resolved;
  const config = catalogueConfiguration();
  if (!config.ok) return config.response;
  const parsed = await bodyFrom(request, config.securityEnv.maxBodyBytes);
  if (!parsed.ok) return parsed.response;

  const masterId = positiveInteger(parsed.body.masterId);
  const seedReleaseId = positiveInteger(parsed.body.seedReleaseId);
  const inputSource =
    typeof parsed.body.inputSource === "string" &&
    INPUT_SOURCES.has(
      parsed.body.inputSource as PressingInvestigationInputSource,
    )
      ? (parsed.body.inputSource as PressingInvestigationInputSource)
      : null;

  if ((!masterId && !seedReleaseId) || !inputSource) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_pressing_investigation",
          message:
            "A release family and a valid identification input source are required.",
        },
      },
      { status: 400 },
    );
  }

  const limited = providerRateLimit(
    resolved.owner.userId,
    config.securityEnv,
  );
  if (limited) return limited;

  try {
    const investigation = await createPressingInvestigation({
      owner: resolved.owner,
      masterId,
      seedReleaseId,
      inputSource,
      evidence: evidenceFrom(parsed.body.evidence),
      token: config.discogsEnv.token,
      userAgent: config.discogsEnv.userAgent,
      requestDelayMs: config.discogsEnv.requestDelayMs,
      cacheTtlMs: config.cacheEnv.ttlMs,
    });

    return NextResponse.json({ investigation }, { status: 201 });
  } catch (error) {
    return pressingInvestigationError(error);
  }
}

export async function PATCH(request: Request) {
  const disabled = disabledCapabilityResponse("pressingProof");
  if (disabled) return disabled;

  const resolved = await authenticatedOwner();
  if (resolved instanceof NextResponse) return resolved;
  const config = catalogueConfiguration();
  if (!config.ok) return config.response;
  const parsed = await bodyFrom(request, config.securityEnv.maxBodyBytes);
  if (!parsed.ok) return parsed.response;

  const id =
    typeof parsed.body.id === "string" ? parsed.body.id.trim() : "";
  const action =
    parsed.body.action === "dismiss" || parsed.body.action === "resolve"
      ? parsed.body.action
      : null;

  if (!id || !action) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_pressing_investigation_update",
          message: "Choose an investigation and a valid update action.",
        },
      },
      { status: 400 },
    );
  }

  if (action === "resolve") {
    const limited = providerRateLimit(
      resolved.owner.userId,
      config.securityEnv,
    );
    if (limited) return limited;
  }

  try {
    const investigation = await updatePressingInvestigation({
      owner: resolved.owner,
      id,
      action,
      evidence:
        action === "resolve" ? evidenceFrom(parsed.body.evidence) : undefined,
      token: config.discogsEnv.token,
      userAgent: config.discogsEnv.userAgent,
      requestDelayMs: config.discogsEnv.requestDelayMs,
      cacheTtlMs: config.cacheEnv.ttlMs,
    });

    return NextResponse.json({ investigation });
  } catch (error) {
    if (error instanceof PressingInvestigationNotFoundError) {
      return NextResponse.json(
        {
          error: {
            code: "pressing_investigation_not_found",
            message: error.message,
          },
        },
        { status: 404 },
      );
    }
    return pressingInvestigationError(error);
  }
}
