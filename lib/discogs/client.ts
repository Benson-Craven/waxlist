import type { DiscogsSearchUnit } from "@/lib/matching/discogs-search-units";

export type DiscogsRateLimit = {
  limit: number | null;
  used: number | null;
  remaining: number | null;
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

type DiscogsMarketplaceStatsResponse = {
  num_for_sale?: number;
  lowest_price?: {
    value?: number;
    currency?: string;
  };
};

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

export async function searchDiscogsForUnit(input: {
  unit: DiscogsSearchUnit;
  token: string;
  userAgent: string;
  perUnitLimit?: number;
}): Promise<DiscogsSearchResult> {
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
        Authorization: `Discogs token=${input.token}`,
        "User-Agent": input.userAgent,
      },
      cache: "no-store",
    },
  );
  const rateLimit = readDiscogsRateLimit(response.headers);

  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");
    const suffix = retryAfter ? ` Retry after ${retryAfter} seconds.` : "";

    throw new Error(
      `Discogs search failed for ${input.unit.artist} - ${input.unit.album} with status ${response.status}.${suffix}`,
    );
  }

  const payload = (await response.json()) as DiscogsSearchResponse;

  return {
    searchUnit: input.unit,
    candidates: (payload.results ?? [])
      .map(normalizeDiscogsCandidate)
      .filter((candidate): candidate is DiscogsSearchCandidate => Boolean(candidate)),
    rateLimit,
  };
}

export async function getDiscogsMarketplaceStats(input: {
  releaseId: number;
  token: string;
  userAgent: string;
}): Promise<DiscogsMarketplaceStats> {
  const response = await fetch(
    `https://api.discogs.com/marketplace/stats/${input.releaseId}`,
    {
      headers: {
        Authorization: `Discogs token=${input.token}`,
        "User-Agent": input.userAgent,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return {
      releaseId: input.releaseId,
      numForSale: null,
      lowestPrice: null,
    };
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
}
