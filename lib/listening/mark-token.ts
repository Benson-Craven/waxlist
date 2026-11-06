import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export type CollectionMarkTokenPayload = {
  version: 1;
  userId: string;
  releaseId: number;
  masterId: number | null;
  artist: string;
  title: string;
  format: string[];
  year: number | null;
  confidence: number;
  expiresAt: number;
};

function signature(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest();
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isPayload(value: unknown): value is CollectionMarkTokenPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<CollectionMarkTokenPayload>;

  return (
    payload.version === 1 &&
    typeof payload.userId === "string" &&
    payload.userId.length > 0 &&
    isPositiveInteger(payload.releaseId) &&
    (payload.masterId === null || isPositiveInteger(payload.masterId)) &&
    typeof payload.artist === "string" &&
    payload.artist.trim().length > 0 &&
    typeof payload.title === "string" &&
    payload.title.trim().length > 0 &&
    Array.isArray(payload.format) &&
    payload.format.every((item) => typeof item === "string") &&
    (payload.year === null || isPositiveInteger(payload.year)) &&
    typeof payload.confidence === "number" &&
    Number.isFinite(payload.confidence) &&
    isPositiveInteger(payload.expiresAt)
  );
}

export function createCollectionMarkToken(input: {
  payload: Omit<CollectionMarkTokenPayload, "version">;
  secret: string;
}) {
  const encodedPayload = Buffer.from(
    JSON.stringify({
      version: 1,
      ...input.payload,
    } satisfies CollectionMarkTokenPayload),
    "utf8",
  ).toString("base64url");
  const encodedSignature = signature(encodedPayload, input.secret).toString(
    "base64url",
  );

  return `${encodedPayload}.${encodedSignature}`;
}

export function verifyCollectionMarkToken(input: {
  token: string;
  expectedUserId: string;
  secret: string;
  now?: number;
}):
  | { ok: true; payload: CollectionMarkTokenPayload }
  | { ok: false; code: "invalid" | "expired" | "wrong_owner" } {
  const [encodedPayload, encodedSignature, ...extra] = input.token.split(".");

  if (!encodedPayload || !encodedSignature || extra.length > 0) {
    return { ok: false, code: "invalid" };
  }

  let actualSignature: Buffer;
  let payload: unknown;

  try {
    actualSignature = Buffer.from(encodedSignature, "base64url");
    payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    );
  } catch {
    return { ok: false, code: "invalid" };
  }

  const expectedSignature = signature(encodedPayload, input.secret);

  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature) ||
    !isPayload(payload)
  ) {
    return { ok: false, code: "invalid" };
  }

  if (payload.userId !== input.expectedUserId) {
    return { ok: false, code: "wrong_owner" };
  }

  if (payload.expiresAt <= (input.now ?? Date.now())) {
    return { ok: false, code: "expired" };
  }

  return { ok: true, payload };
}
