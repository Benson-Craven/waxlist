import "server-only";

import {
  LISTENBRAINZ_MAX_LISTENS,
  type ListenBrainzListen,
} from "@/lib/listening/listenbrainz/normalize";

const LISTENBRAINZ_API_ROOT = "https://api.listenbrainz.org";

export type ListenBrainzRateLimit = {
  limit: number | null;
  remaining: number | null;
  resetInSeconds: number | null;
};

export type ListenBrainzErrorCode =
  | "listenbrainz_user_not_found"
  | "listenbrainz_rate_limited"
  | "listenbrainz_provider_error";

function readWholeNumber(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function readRateLimit(headers: Headers): ListenBrainzRateLimit {
  return {
    limit: readWholeNumber(headers.get("x-ratelimit-limit")),
    remaining: readWholeNumber(headers.get("x-ratelimit-remaining")),
    resetInSeconds: readWholeNumber(headers.get("x-ratelimit-reset-in")),
  };
}

async function readProviderMessage(response: Response) {
  try {
    const payload = (await response.json()) as {
      error?: unknown;
      message?: unknown;
    };
    const value =
      typeof payload.error === "string"
        ? payload.error
        : typeof payload.message === "string"
          ? payload.message
          : null;
    return value?.slice(0, 240) ?? null;
  } catch {
    return null;
  }
}

export class ListenBrainzApiError extends Error {
  constructor(
    public readonly code: ListenBrainzErrorCode,
    message: string,
    public readonly status: number,
    public readonly retryAfterSeconds: number | null,
    public readonly rateLimit: ListenBrainzRateLimit,
    public readonly providerMessage: string | null,
  ) {
    super(message);
    this.name = "ListenBrainzApiError";
  }

  toStructuredError() {
    return {
      code: this.code,
      message: this.message,
      status: this.status,
      retryAfterSeconds: this.retryAfterSeconds,
      rateLimit: this.rateLimit,
      providerMessage: this.providerMessage,
    };
  }
}

export async function fetchListenBrainzListens(input: {
  username: string;
  windowDays: 30 | 90 | 365;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const minimumTimestamp =
    Math.floor(now.getTime() / 1000) - input.windowDays * 86_400;
  const url = new URL(
    `/1/user/${encodeURIComponent(input.username)}/listens`,
    LISTENBRAINZ_API_ROOT,
  );
  url.searchParams.set("count", String(LISTENBRAINZ_MAX_LISTENS));
  url.searchParams.set("min_ts", String(minimumTimestamp));

  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "WAXLIST/0.1",
      },
      cache: "no-store",
    });
  } catch {
    throw new ListenBrainzApiError(
      "listenbrainz_provider_error",
      "ListenBrainz could not be reached. Your previous crate is still available.",
      0,
      null,
      {
        limit: null,
        remaining: null,
        resetInSeconds: null,
      },
      null,
    );
  }

  const rateLimit = readRateLimit(response.headers);

  if (!response.ok) {
    const providerMessage = await readProviderMessage(response);

    if (response.status === 404) {
      throw new ListenBrainzApiError(
        "listenbrainz_user_not_found",
        "That ListenBrainz username was not found.",
        response.status,
        null,
        rateLimit,
        providerMessage,
      );
    }

    if (response.status === 429) {
      throw new ListenBrainzApiError(
        "listenbrainz_rate_limited",
        "ListenBrainz is rate limiting imports. Try again after the suggested wait.",
        response.status,
        rateLimit.resetInSeconds,
        rateLimit,
        providerMessage,
      );
    }

    throw new ListenBrainzApiError(
      "listenbrainz_provider_error",
      "ListenBrainz could not complete this import. Your previous crate is still available.",
      response.status,
      null,
      rateLimit,
      providerMessage,
    );
  }

  const payload = (await response.json()) as {
    payload?: {
      listens?: ListenBrainzListen[];
    };
  };

  return {
    listens: Array.isArray(payload.payload?.listens)
      ? payload.payload.listens.slice(0, LISTENBRAINZ_MAX_LISTENS)
      : [],
    rateLimit,
  };
}
