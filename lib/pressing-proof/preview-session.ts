import {
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

export const PRESSING_PREVIEW_COOKIE = "waxlist_pressing_preview";
export const PRESSING_PREVIEW_TTL_MS = 24 * 60 * 60 * 1000;

export type PressingPreviewSession = {
  investigationId: string;
  familyKey: string;
  ipHash: string;
  issuedAt: number;
  expiresAt: number;
};

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createPressingPreviewSession(input: {
  secret: string;
  investigationId?: string;
  familyKey: string;
  ipHash: string;
  now?: Date;
}) {
  const issuedAt = (input.now ?? new Date()).getTime();
  const payload: PressingPreviewSession = {
    investigationId: input.investigationId ?? randomUUID(),
    familyKey: input.familyKey,
    ipHash: input.ipHash,
    issuedAt,
    expiresAt: issuedAt + PRESSING_PREVIEW_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );

  return `v1.${encoded}.${sign(encoded, input.secret)}`;
}

export function readPressingPreviewSession(input: {
  secret: string;
  value: string | null | undefined;
  now?: Date;
}): PressingPreviewSession | null {
  const [version, encoded, signature, ...rest] = input.value?.split(".") ?? [];

  if (
    version !== "v1" ||
    !encoded ||
    !signature ||
    rest.length > 0
  ) {
    return null;
  }

  const expected = sign(encoded, input.secret);
  const suppliedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<PressingPreviewSession>;
    const now = (input.now ?? new Date()).getTime();

    if (
      typeof payload.investigationId !== "string" ||
      typeof payload.familyKey !== "string" ||
      typeof payload.ipHash !== "string" ||
      typeof payload.issuedAt !== "number" ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= now ||
      payload.expiresAt - payload.issuedAt !== PRESSING_PREVIEW_TTL_MS
    ) {
      return null;
    }

    return payload as PressingPreviewSession;
  } catch {
    return null;
  }
}
