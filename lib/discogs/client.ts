import { apiCacheKeys, getOrSetApiCache } from "@/lib/cache/api-cache";
import type { DiscogsSearchUnit } from "@/lib/matching/discogs-search-units";

export type DiscogsRateLimit = {
  limit: number | null;
  used: number | null;
  remaining: number | null;
};

export type DiscogsErrorCode =
  | "discogs_rate_limited"
  | "discogs_auth_failed"
  | "discogs_not_found"
  | "discogs_provider_error";

export type StructuredDiscogsError = {
  code: DiscogsErrorCode;
  message: string;
  status: number;
  retryAfterSeconds: number | null;
  rateLimit: DiscogsRateLimit;
  providerMessage: string | null;
};

export type DiscogsSearchCandidate = {
  id: number;
  type: string | null;
  title: string;
  year: number | null;
  format: string[];
  country: string | null;
  thumb: string | null;
  uri: string | null;
  resourceUrl: string | null;
};

export type DiscogsMarketplaceStats = {
  releaseId: number;
  numForSale: number | null;
  lowestPrice: {
    value: number;
    currency: string;
  } | null;
};

export type DiscogsSearchResult = {
  searchUnit: DiscogsSearchUnit;
  candidates: DiscogsSearchCandidate[];
  rateLimit: DiscogsRateLimit;
};

export type DiscogsIdentity = {
  username: string;
  rateLimit: DiscogsRateLimit;
};

export type DiscogsCollectionRelease = {
  instanceId: number;
  folderId: number;
  releaseId: number;
  masterId: number | null;
  artist: string;
  title: string;
  format: string[];
  year: number | null;
  label: string | null;
  catalogNumber: string | null;
  barcode: string | null;
  imageUrl: string | null;
};

export type DiscogsCollectionPage = {
  page: number;
  perPage: number;
  totalPages: number;
  totalItems: number;
  releases: DiscogsCollectionRelease[];
  rateLimit: DiscogsRateLimit;
};

type DiscogsSearchResponse = {
  results?: Array<{
    id?: number;
    type?: string;
    title?: string;
    year?: string | number;
    format?: string[];
    country?: string;
    thumb?: string;
    uri?: string;
    resource_url?: string;
  }>;
};

type DiscogsIdentityResponse = {
  username?: string;
};

type DiscogsCollectionResponse = {
  pagination?: {
    page?: number;
    pages?: number;
    per_page?: number;
    items?: number;
  };
  releases?: Array<{
    instance_id?: number;
    folder_id?: number;
    id?: number;
    basic_information?: {
      id?: number;
      master_id?: number;
      title?: string;
      year?: number;
      thumb?: string;
      cover_image?: string;
      artists?: Array<{
        name?: string;
      }>;
      formats?: Array<{
        name?: string;
        descriptions?: string[];
      }>;
      labels?: Array<{
        name?: string;
        catno?: string;
      }>;
      identifiers?: Array<{
        type?: string;
        value?: string;
      }>;
    };
  }>;
};

type DiscogsMarketplaceStatsResponse = {
  num_for_sale?: number;
  lowest_price?: {
    value?: number;
    currency?: string;
  };
};

type CachedDiscogsSearchResult = Omit<DiscogsSearchResult, "searchUnit">;

type DiscogsErrorPayload = {
  message?: string;
  error?: string;
};

export class DiscogsApiError extends Error {
  code: DiscogsErrorCode;
  status: number;
  retryAfterSeconds: number | null;
  rateLimit: DiscogsRateLimit;
  providerMessage: string | null;

  constructor(error: StructuredDiscogsError) {
    super(error.message);
    this.name = "DiscogsApiError";
    this.code = error.code;
    this.status = error.status;
    this.retryAfterSeconds = error.retryAfterSeconds;
    this.rateLimit = error.rateLimit;
    this.providerMessage = error.providerMessage;
  }

  toStructuredError(): StructuredDiscogsError {
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

function parseNumberHeader(headers: Headers, name: string) {
  const rawValue = headers.get(name);

  if (!rawValue) {
    return null;
  }

  const parsed = Number.parseInt(rawValue, 10);

  return Number.isFinite(parsed) ? parsed : null;
}

function readDiscogsRateLimit(headers: Headers): DiscogsRateLimit {
  return {
    limit: parseNumberHeader(headers, "x-discogs-ratelimit"),
    used: parseNumberHeader(headers, "x-discogs-ratelimit-used"),
    remaining: parseNumberHeader(headers, "x-discogs-ratelimit-remaining"),
  };
}

function authHeaders(input: { token: string; userAgent: string }) {
  return {
    Authorization: `Discogs token=${input.token}`,
    "User-Agent": input.userAgent,
  };
}

function parseRetryAfterSeconds(headers: Headers) {
  const rawValue = headers.get("retry-after");

  if (!rawValue) {
    return null;
  }

  const seconds = Number.parseInt(rawValue, 10);

  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds);
  }

  const retryAt = Date.parse(rawValue);

  if (!Number.isFinite(retryAt)) {
    return null;
  }

  return Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
}

function getDiscogsErrorCode(status: number): DiscogsErrorCode {
  if (status === 429) {
    return "discogs_rate_limited";
  }

  if (status === 401 || status === 403) {
    return "discogs_auth_failed";
  }

  if (status === 404) {
    return "discogs_not_found";
  }

  return "discogs_provider_error";
}

function getFriendlyDiscogsErrorMessage(input: {
  status: number;
  retryAfterSeconds: number | null;
}) {
  if (input.status === 429) {
    return input.retryAfterSeconds !== null
      ? `Discogs is rate limiting requests. Please retry in about ${input.retryAfterSeconds.toLocaleString()} seconds.`
      : "Discogs is rate limiting requests. Please wait a moment and retry.";
  }

  if (input.status === 401 || input.status === 403) {
    return "Discogs rejected the server credentials. Check DISCOGS_TOKEN and try again.";
  }

  return "Discogs could not complete this request. Please retry in a moment.";
}

async function readDiscogsErrorPayload(response: Response) {
  try {
    const payload = (await response.json()) as DiscogsErrorPayload;

    return payload.message ?? payload.error ?? null;
  } catch {
    return null;
  }
}

export async function createDiscogsApiError(response: Response) {
  const retryAfterSeconds = parseRetryAfterSeconds(response.headers);
  const providerMessage = await readDiscogsErrorPayload(response);

  return new DiscogsApiError({
    code: getDiscogsErrorCode(response.status),
    message: getFriendlyDiscogsErrorMessage({
      status: response.status,
      retryAfterSeconds,
    }),
    status: response.status,
    retryAfterSeconds,
    rateLimit: readDiscogsRateLimit(response.headers),
    providerMessage,
  });
}

function normalizeDiscogsCandidate(
  result: NonNullable<DiscogsSearchResponse["results"]>[number],
): DiscogsSearchCandidate | null {
  if (!result.id || !result.title) {
    return null;
  }

  const parsedYear =
    typeof result.year === "number"
      ? result.year
      : Number.parseInt(result.year ?? "", 10);

  return {
    id: result.id,
    type: result.type ?? null,
    title: result.title,
    year: Number.isFinite(parsedYear) ? parsedYear : null,
    format: result.format ?? [],
    country: result.country ?? null,
    thumb: result.thumb ?? null,
    uri: result.uri ? `https://www.discogs.com${result.uri}` : null,
    resourceUrl: result.resource_url ?? null,
  };
}

function firstCleanString(values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function normalizeDiscogsCollectionRelease(
  item: NonNullable<DiscogsCollectionResponse["releases"]>[number],
): DiscogsCollectionRelease | null {
  const basicInformation = item.basic_information;
  const releaseId = basicInformation?.id ?? item.id;
  const instanceId = item.instance_id;
  const folderId = item.folder_id;
  const title = firstCleanString([basicInformation?.title]);
  const artist = firstCleanString(
    basicInformation?.artists?.map((entry) => entry.name) ?? [],
  );

  if (!releaseId || !instanceId || !folderId || !title || !artist) {
    return null;
  }

  const format = Array.from(
    new Set(
      (basicInformation?.formats ?? [])
        .flatMap((formatEntry) => [
          formatEntry.name,
          ...(formatEntry.descriptions ?? []),
        ])
        .filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0,
        )
        .map((value) => value.trim()),
    ),
  );
  const firstLabel = basicInformation?.labels?.[0];
  const barcode = firstCleanString(
    (basicInformation?.identifiers ?? [])
      .filter((identifier) => identifier.type?.toLowerCase() === "barcode")
      .map((identifier) => identifier.value),
  );

  return {
    instanceId,
    folderId,
    releaseId,
    masterId: basicInformation?.master_id || null,
    artist,
    title,
    format,
    year:
      typeof basicInformation?.year === "number" && basicInformation.year > 0
        ? basicInformation.year
        : null,
    label: firstCleanString([firstLabel?.name]),
    catalogNumber: firstCleanString([firstLabel?.catno]),
    barcode,
    imageUrl: firstCleanString([
      basicInformation?.cover_image,
      basicInformation?.thumb,
    ]),
  };
}

export async function getDiscogsIdentity(input: {
  token: string;
  userAgent: string;
}): Promise<DiscogsIdentity> {
  const response = await fetch("https://api.discogs.com/oauth/identity", {
    headers: authHeaders(input),
    cache: "no-store",
  });
  const rateLimit = readDiscogsRateLimit(response.headers);

  if (!response.ok) {
    throw await createDiscogsApiError(response);
  }

  const payload = (await response.json()) as DiscogsIdentityResponse;
  const username = payload.username?.trim();

  if (!username) {
    throw new DiscogsApiError({
      code: "discogs_provider_error",
      message: "Discogs identity did not include a username.",
      status: 502,
      retryAfterSeconds: null,
      rateLimit,
      providerMessage: null,
    });
  }

  return {
    username,
    rateLimit,
  };
}

export async function getDiscogsCollectionPage(input: {
  username: string;
  folderId?: number;
  page: number;
  perPage: number;
  token: string;
  userAgent: string;
}): Promise<DiscogsCollectionPage> {
  const searchParams = new URLSearchParams({
    page: String(input.page),
    per_page: String(input.perPage),
    sort: "added",
    sort_order: "desc",
  });
  const folderId = input.folderId ?? 0;
  const response = await fetch(
    `https://api.discogs.com/users/${encodeURIComponent(
      input.username,
    )}/collection/folders/${folderId}/releases?${searchParams}`,
    {
      headers: authHeaders(input),
      cache: "no-store",
    },
  );
  const rateLimit = readDiscogsRateLimit(response.headers);

  if (!response.ok) {
    throw await createDiscogsApiError(response);
  }

  const payload = (await response.json()) as DiscogsCollectionResponse;
  const pagination = payload.pagination ?? {};

  return {
    page: pagination.page ?? input.page,
    perPage: pagination.per_page ?? input.perPage,
    totalPages: pagination.pages ?? input.page,
    totalItems: pagination.items ?? 0,
    releases: (payload.releases ?? [])
      .map(normalizeDiscogsCollectionRelease)
      .filter((release): release is DiscogsCollectionRelease => Boolean(release)),
    rateLimit,
  };
}

export async function searchDiscogsForUnit(input: {
  unit: DiscogsSearchUnit;
  token: string;
  userAgent: string;
  perUnitLimit?: number;
  cacheTtlMs?: number;
}): Promise<DiscogsSearchResult> {
  const cachedSearch = await getOrSetApiCache<CachedDiscogsSearchResult>(
    apiCacheKeys.discogsSearch(
      input.unit.normalizedArtist,
      input.unit.normalizedAlbum,
    ),
    input.cacheTtlMs ?? 0,
    async () => {
      const searchParams = new URLSearchParams({
        type: "release",
        format: "vinyl",
        artist: input.unit.artist,
        release_title: input.unit.album,
        q: input.unit.query,
        per_page: String(input.perUnitLimit ?? 5),
        page: "1",
      });
      const response = await fetch(
        `https://api.discogs.com/database/search?${searchParams}`,
        {
          headers: {
            ...authHeaders(input),
          },
          cache: "no-store",
        },
      );
      const rateLimit = readDiscogsRateLimit(response.headers);

      if (!response.ok) {
        throw await createDiscogsApiError(response);
      }

      const payload = (await response.json()) as DiscogsSearchResponse;

      return {
        candidates: (payload.results ?? [])
          .map(normalizeDiscogsCandidate)
          .filter((candidate): candidate is DiscogsSearchCandidate =>
            Boolean(candidate),
          ),
        rateLimit,
      };
    },
  );

  return {
    searchUnit: input.unit,
    ...cachedSearch,
  };
}

export async function getDiscogsMarketplaceStats(input: {
  releaseId: number;
  token: string;
  userAgent: string;
  cacheTtlMs?: number;
}): Promise<DiscogsMarketplaceStats> {
  return getOrSetApiCache(
    apiCacheKeys.discogsMarketplace(input.releaseId),
    input.cacheTtlMs ?? 0,
    async () => {
      const response = await fetch(
        `https://api.discogs.com/marketplace/stats/${input.releaseId}`,
        {
          headers: {
            ...authHeaders(input),
          },
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw await createDiscogsApiError(response);
      }

      const payload = (await response.json()) as DiscogsMarketplaceStatsResponse;
      const lowestPriceValue = payload.lowest_price?.value;
      const lowestPriceCurrency = payload.lowest_price?.currency;

      return {
        releaseId: input.releaseId,
        numForSale:
          typeof payload.num_for_sale === "number" ? payload.num_for_sale : null,
        lowestPrice:
          typeof lowestPriceValue === "number" && lowestPriceCurrency
            ? {
                value: lowestPriceValue,
                currency: lowestPriceCurrency,
              }
            : null,
      };
    },
  );
}
