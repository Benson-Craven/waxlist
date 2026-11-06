import "server-only";

import { getOrSetApiCache } from "@/lib/cache/api-cache";
import type { DiscogsSearchUnit } from "@/lib/matching/discogs-search-units";
import type {
  PressingCandidate,
  PressingIdentifier,
} from "@/lib/pressing-detective/matching";

const DISCOGS_API_ROOT = "https://api.discogs.com";
const MAX_PUBLIC_CATALOGUE_CACHE_MS = 60 * 60 * 1000;

export type DiscogsCatalogueRateLimit = {
  limit: number | null;
  used: number | null;
  remaining: number | null;
};

export type DiscogsCatalogueCandidate = {
  id: number;
  masterId: number | null;
  type: string | null;
  title: string;
  year: number | null;
  format: string[];
  country: string | null;
  uri: string | null;
};

export type DiscogsPressingSearchQuery = {
  query?: string;
  artist?: string;
  title?: string;
  barcode?: string;
  catalogNumber?: string;
};

export type DiscogsPressingSeed = {
  id: number;
  masterId: number | null;
  title: string;
  year: number | null;
  formats: string[];
  country: string | null;
  labels: string[];
  catalogNumbers: string[];
  barcodes: string[];
  uri: string;
};

const DISCOGS_ATTRIBUTION = {
  label: "Catalogue data provided by Discogs",
  url: "https://www.discogs.com",
} as const;

export class DiscogsCatalogueError extends Error {
  constructor(
    public readonly code:
      | "discogs_rate_limited"
      | "discogs_auth_failed"
      | "discogs_provider_error",
    message: string,
    public readonly status: number,
    public readonly retryAfterSeconds: number | null,
    public readonly rateLimit: DiscogsCatalogueRateLimit,
  ) {
    super(message);
    this.name = "DiscogsCatalogueError";
  }
}

function wholeNumber(value: string | null) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function readRateLimit(headers: Headers): DiscogsCatalogueRateLimit {
  return {
    limit: wholeNumber(headers.get("x-discogs-ratelimit")),
    used: wholeNumber(headers.get("x-discogs-ratelimit-used")),
    remaining: wholeNumber(headers.get("x-discogs-ratelimit-remaining")),
  };
}

function optionalPositiveInteger(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function textList(value: unknown) {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map(optionalText)
          .filter((item): item is string => item !== null),
      ),
    );
  }

  const text = optionalText(value);
  return text ? [text] : [];
}

function discogsDeepLink(value: unknown, releaseId: number) {
  const uri = optionalText(value);

  if (uri?.startsWith("https://www.discogs.com/")) {
    return uri;
  }

  if (uri?.startsWith("/")) {
    return `https://www.discogs.com${uri}`;
  }

  return `https://www.discogs.com/release/${releaseId}`;
}

function catalogueObject(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function sanitizeCataloguePayload(
  path: string,
  payload: Record<string, unknown>,
) {
  if (path === "/database/search") {
    const pagination = catalogueObject(payload.pagination);

    return {
      pagination: {
        items: pagination.items,
        page: pagination.page,
        pages: pagination.pages,
        per_page: pagination.per_page,
      },
      results: Array.isArray(payload.results)
        ? payload.results.map((value) => {
            const result = catalogueObject(value);
            return {
              id: result.id,
              master_id: result.master_id,
              type: result.type,
              title: result.title,
              year: result.year,
              format: result.format,
              country: result.country,
              label: result.label,
              catno: result.catno,
              barcode: result.barcode,
              uri: result.uri,
            };
          })
        : [],
    };
  }

  if (/^\/releases\/\d+$/.test(path)) {
    return {
      id: payload.id,
      master_id: payload.master_id,
      title: payload.title,
      artists: Array.isArray(payload.artists)
        ? payload.artists.map((value) => ({
            name: catalogueObject(value).name,
          }))
        : [],
      country: payload.country,
      year: payload.year,
      formats: Array.isArray(payload.formats)
        ? payload.formats.map((value) => {
            const format = catalogueObject(value);
            return {
              name: format.name,
              descriptions: format.descriptions,
            };
          })
        : [],
      labels: Array.isArray(payload.labels)
        ? payload.labels.map((value) => {
            const label = catalogueObject(value);
            return { name: label.name, catno: label.catno };
          })
        : [],
      identifiers: Array.isArray(payload.identifiers)
        ? payload.identifiers.map((value) => {
            const identifier = catalogueObject(value);
            return {
              type: identifier.type,
              value: identifier.value,
              description: identifier.description,
            };
          })
        : [],
      companies: Array.isArray(payload.companies)
        ? payload.companies.map((value) => {
            const company = catalogueObject(value);
            return {
              name: company.name,
              entity_type_name: company.entity_type_name,
            };
          })
        : [],
      extraartists: Array.isArray(payload.extraartists)
        ? payload.extraartists.map((value) => {
            const credit = catalogueObject(value);
            return { name: credit.name, role: credit.role };
          })
        : [],
      uri: payload.uri,
    };
  }

  const pagination = catalogueObject(payload.pagination);
  return {
    pagination: {
      items: pagination.items,
      page: pagination.page,
      pages: pagination.pages,
      per_page: pagination.per_page,
    },
    versions: Array.isArray(payload.versions)
      ? payload.versions.map((value) => {
          const version = catalogueObject(value);
          return {
            id: version.id,
            title: version.title,
            country: version.country,
            released: version.released,
            format: version.format,
            label: version.label,
            catno: version.catno,
            uri: version.uri,
          };
        })
      : [],
  };
}

async function loadCatalogueJson(input: {
  path: string;
  searchParams?: URLSearchParams;
  cacheKey: string;
  token: string;
  userAgent: string;
  cacheTtlMs: number;
}) {
  const cacheTtlMs = Math.min(
    Math.max(0, input.cacheTtlMs),
    MAX_PUBLIC_CATALOGUE_CACHE_MS,
  );

  return getOrSetApiCache(input.cacheKey, cacheTtlMs, async () => {
    const url = new URL(input.path, DISCOGS_API_ROOT);

    if (input.searchParams) {
      url.search = input.searchParams.toString();
    }

    let response: Response;

    try {
      response = await fetch(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Discogs token=${input.token}`,
          "User-Agent": input.userAgent,
        },
        cache: "no-store",
      });
    } catch {
      throw new DiscogsCatalogueError(
        "discogs_provider_error",
        "Discogs catalogue matching is temporarily unavailable.",
        0,
        null,
        { limit: null, used: null, remaining: null },
      );
    }

    const rateLimit = readRateLimit(response.headers);

    if (!response.ok) {
      const retryAfterSeconds =
        wholeNumber(response.headers.get("retry-after")) ??
        (response.status === 429 ? 60 : null);
      const code =
        response.status === 429
          ? "discogs_rate_limited"
          : response.status === 401 || response.status === 403
            ? "discogs_auth_failed"
            : "discogs_provider_error";

      throw new DiscogsCatalogueError(
        code,
        code === "discogs_rate_limited"
          ? "Discogs is rate limiting catalogue matching."
          : "Discogs catalogue matching could not be completed.",
        response.status,
        retryAfterSeconds,
        rateLimit,
      );
    }

    const rawPayload = (await response.json()) as Record<string, unknown>;

    return {
      payload: sanitizeCataloguePayload(input.path, rawPayload),
      rateLimit,
      checkedAt: new Date().toISOString(),
    };
  });
}

function parseIdentifier(value: unknown): PressingIdentifier | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const identifier = value as Record<string, unknown>;
  const type = optionalText(identifier.type);
  const identifierValue = optionalText(identifier.value);

  if (!type || !identifierValue) {
    return null;
  }

  return {
    type,
    value: identifierValue,
    description: optionalText(identifier.description),
  };
}

function isMatrixIdentifier(identifier: PressingIdentifier) {
  return identifier.type.toLowerCase().includes("matrix");
}

function isBarcodeIdentifier(identifier: PressingIdentifier) {
  return identifier.type.toLowerCase().includes("barcode");
}

function parseCatalogueRelease(
  payload: Record<string, unknown>,
  fallbackReleaseId: number,
): PressingCandidate {
  const id = optionalPositiveInteger(payload.id) ?? fallbackReleaseId;
  const artists = Array.isArray(payload.artists)
    ? payload.artists
        .map((artist) =>
          artist && typeof artist === "object"
            ? optionalText((artist as Record<string, unknown>).name)
            : null,
        )
        .filter((artist): artist is string => artist !== null)
    : [];
  const artist = artists.join(", ") || null;
  const releaseTitle = optionalText(payload.title) ?? `Discogs release ${id}`;
  const formats = Array.isArray(payload.formats)
    ? payload.formats.flatMap((format) => {
        if (!format || typeof format !== "object") return [];
        const record = format as Record<string, unknown>;
        return [
          optionalText(record.name),
          ...textList(record.descriptions),
        ].filter((value): value is string => value !== null);
      })
    : [];
  const labels = Array.isArray(payload.labels)
    ? payload.labels
        .map((label) =>
          label && typeof label === "object"
            ? optionalText((label as Record<string, unknown>).name)
            : null,
        )
        .filter((label): label is string => label !== null)
    : [];
  const catalogNumbers = Array.isArray(payload.labels)
    ? payload.labels
        .map((label) =>
          label && typeof label === "object"
            ? optionalText((label as Record<string, unknown>).catno)
            : null,
        )
        .filter((catalogNumber): catalogNumber is string => catalogNumber !== null)
    : [];
  const identifiers = Array.isArray(payload.identifiers)
    ? payload.identifiers
        .map(parseIdentifier)
        .filter(
          (identifier): identifier is PressingIdentifier => identifier !== null,
        )
    : [];
  const companies = Array.isArray(payload.companies)
    ? payload.companies
    : [];
  const pressingPlants = companies.flatMap((company) => {
    if (!company || typeof company !== "object") return [];
    const record = company as Record<string, unknown>;
    const role = optionalText(record.entity_type_name)?.toLowerCase() ?? "";
    const name = optionalText(record.name);

    return name && (role.includes("pressed") || role.includes("manufactured"))
      ? [name]
      : [];
  });
  const masteringCredits = Array.isArray(payload.extraartists)
    ? payload.extraartists.flatMap((credit) => {
        if (!credit || typeof credit !== "object") return [];
        const record = credit as Record<string, unknown>;
        const role = optionalText(record.role)?.toLowerCase() ?? "";
        const name = optionalText(record.name);

        return name && (role.includes("master") || role.includes("lacquer"))
          ? [name]
          : [];
      })
    : [];

  return {
    id,
    masterId: optionalPositiveInteger(payload.master_id),
    title: artist ? `${artist} - ${releaseTitle}` : releaseTitle,
    artist,
    country: optionalText(payload.country),
    year: optionalPositiveInteger(payload.year),
    formats: Array.from(new Set(formats)),
    labels: Array.from(new Set(labels)),
    catalogNumbers: Array.from(new Set(catalogNumbers)),
    barcodes: Array.from(
      new Set(identifiers.filter(isBarcodeIdentifier).map(({ value }) => value)),
    ),
    matrixRunouts: Array.from(
      new Set(identifiers.filter(isMatrixIdentifier).map(({ value }) => value)),
    ),
    pressingPlants: Array.from(new Set(pressingPlants)),
    masteringCredits: Array.from(new Set(masteringCredits)),
    identifiers,
    notes: null,
    imageUrl: null,
    uri: discogsDeepLink(payload.uri, id),
    resourceUrl: null,
    detailLoaded: true,
  };
}

export async function searchDiscogsPressings(input: {
  query: DiscogsPressingSearchQuery;
  token: string;
  userAgent: string;
  cacheTtlMs: number;
}) {
  const searchParams = new URLSearchParams({
    format: "vinyl",
    type: "release",
    per_page: "20",
  });
  const queryFields = [
    ["q", input.query.query],
    ["artist", input.query.artist],
    ["release_title", input.query.title],
    ["barcode", input.query.barcode],
    ["catno", input.query.catalogNumber],
  ] as const;

  for (const [key, value] of queryFields) {
    const cleanValue = value?.trim();
    if (cleanValue) searchParams.set(key, cleanValue);
  }

  const cacheIdentity = Array.from(searchParams.entries())
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([key, value]) => `${key}:${value.toLowerCase()}`)
    .join("|");
  const result = await loadCatalogueJson({
    path: "/database/search",
    searchParams,
    cacheKey: `discogs:cc0-pressing-search:${cacheIdentity}`,
    token: input.token,
    userAgent: input.userAgent,
    cacheTtlMs: input.cacheTtlMs,
  });
  const candidates = Array.isArray(result.payload.results)
    ? result.payload.results.flatMap((value): DiscogsPressingSeed[] => {
        if (!value || typeof value !== "object") return [];
        const record = value as Record<string, unknown>;
        const id = optionalPositiveInteger(record.id);
        const title = optionalText(record.title);

        if (!id || !title) return [];

        return [{
          id,
          masterId: optionalPositiveInteger(record.master_id),
          title,
          year: optionalPositiveInteger(record.year),
          formats: textList(record.format),
          country: optionalText(record.country),
          labels: textList(record.label),
          catalogNumbers: textList(record.catno),
          barcodes: textList(record.barcode),
          uri: discogsDeepLink(record.uri, id),
        }];
      })
    : [];

  return {
    candidates,
    totalItems:
      result.payload.pagination &&
      typeof result.payload.pagination === "object"
        ? optionalPositiveInteger(
            (result.payload.pagination as Record<string, unknown>).items,
          ) ?? candidates.length
        : candidates.length,
    rateLimit: result.rateLimit,
    checkedAt: result.checkedAt,
    attribution: DISCOGS_ATTRIBUTION,
  };
}

export async function getDiscogsCatalogueRelease(input: {
  releaseId: number;
  token: string;
  userAgent: string;
  cacheTtlMs: number;
}) {
  const result = await loadCatalogueJson({
    path: `/releases/${input.releaseId}`,
    cacheKey: `discogs:cc0-release:${input.releaseId}`,
    token: input.token,
    userAgent: input.userAgent,
    cacheTtlMs: input.cacheTtlMs,
  });

  return {
    candidate: parseCatalogueRelease(result.payload, input.releaseId),
    rateLimit: result.rateLimit,
    checkedAt: result.checkedAt,
    attribution: DISCOGS_ATTRIBUTION,
  };
}

export async function getDiscogsCatalogueMasterVersions(input: {
  masterId: number;
  page: number;
  perPage: number;
  token: string;
  userAgent: string;
  cacheTtlMs: number;
}) {
  const searchParams = new URLSearchParams({
    page: String(input.page),
    per_page: String(input.perPage),
    format: "Vinyl",
  });
  const result = await loadCatalogueJson({
    path: `/masters/${input.masterId}/versions`,
    searchParams,
    cacheKey: `discogs:cc0-master-versions:${input.masterId}:${input.page}:${input.perPage}:vinyl`,
    token: input.token,
    userAgent: input.userAgent,
    cacheTtlMs: input.cacheTtlMs,
  });
  const versions = Array.isArray(result.payload.versions)
    ? result.payload.versions.flatMap((value): PressingCandidate[] => {
        if (!value || typeof value !== "object") return [];
        const record = value as Record<string, unknown>;
        const id = optionalPositiveInteger(record.id);
        const title = optionalText(record.title);

        if (!id || !title) return [];

        return [{
          id,
          masterId: input.masterId,
          title,
          artist: null,
          country: optionalText(record.country),
          year: optionalPositiveInteger(record.released),
          formats: textList(record.format),
          labels: textList(record.label),
          catalogNumbers: textList(record.catno),
          barcodes: [],
          matrixRunouts: [],
          pressingPlants: [],
          masteringCredits: [],
          identifiers: [],
          notes: null,
          imageUrl: null,
          uri: discogsDeepLink(record.uri, id),
          resourceUrl: null,
          detailLoaded: false,
        }];
      })
    : [];
  const pagination =
    result.payload.pagination &&
    typeof result.payload.pagination === "object"
      ? (result.payload.pagination as Record<string, unknown>)
      : {};

  return {
    masterId: input.masterId,
    versions,
    totalItems: optionalPositiveInteger(pagination.items) ?? versions.length,
    page: optionalPositiveInteger(pagination.page) ?? input.page,
    totalPages: optionalPositiveInteger(pagination.pages) ?? 1,
    perPage: optionalPositiveInteger(pagination.per_page) ?? input.perPage,
    rateLimit: result.rateLimit,
    checkedAt: result.checkedAt,
    attribution: DISCOGS_ATTRIBUTION,
  };
}

export async function searchDiscogsCatalogue(input: {
  unit: DiscogsSearchUnit;
  token: string;
  userAgent: string;
  cacheTtlMs: number;
}) {
  const cacheTtlMs = Math.min(
    Math.max(0, input.cacheTtlMs),
    MAX_PUBLIC_CATALOGUE_CACHE_MS,
  );
  const cacheKey = `discogs:cc0-search:${input.unit.normalizedArtist}:${input.unit.normalizedAlbum}`;

  const catalogueResult = await getOrSetApiCache(
    cacheKey,
    cacheTtlMs,
    async () => {
      const url = new URL("/database/search", DISCOGS_API_ROOT);
      url.searchParams.set("artist", input.unit.artist);
      url.searchParams.set("release_title", input.unit.album);
      url.searchParams.set("format", "vinyl");
      url.searchParams.set("type", "release");
      url.searchParams.set("per_page", "10");

      let response: Response;

      try {
        response = await fetch(url, {
          headers: {
            Accept: "application/json",
            Authorization: `Discogs token=${input.token}`,
            "User-Agent": input.userAgent,
          },
          cache: "no-store",
        });
      } catch {
        throw new DiscogsCatalogueError(
          "discogs_provider_error",
          "Discogs catalogue matching is temporarily unavailable.",
          0,
          null,
          { limit: null, used: null, remaining: null },
        );
      }

      const rateLimit = readRateLimit(response.headers);

      if (!response.ok) {
        const retryAfterSeconds =
          wholeNumber(response.headers.get("retry-after")) ??
          (response.status === 429 ? 60 : null);
        const code =
          response.status === 429
            ? "discogs_rate_limited"
            : response.status === 401 || response.status === 403
              ? "discogs_auth_failed"
              : "discogs_provider_error";

        throw new DiscogsCatalogueError(
          code,
          code === "discogs_rate_limited"
            ? "Discogs is rate limiting catalogue matching."
            : "Discogs catalogue matching could not be completed.",
          response.status,
          retryAfterSeconds,
          rateLimit,
        );
      }

      const payload = (await response.json()) as {
        results?: Array<Record<string, unknown>>;
      };
      const candidates = (payload.results ?? [])
        .map((result): DiscogsCatalogueCandidate | null => {
          const id = optionalPositiveInteger(result.id);
          const title = optionalText(result.title);

          if (!id || !title) return null;

          return {
            id,
            masterId: optionalPositiveInteger(result.master_id),
            type: optionalText(result.type),
            title,
            year: optionalPositiveInteger(result.year),
            format: Array.isArray(result.format)
              ? result.format.filter(
                  (value): value is string => typeof value === "string",
                )
              : [],
            country: optionalText(result.country),
            uri: optionalText(result.uri),
          };
        })
        .filter(
          (candidate): candidate is DiscogsCatalogueCandidate =>
            candidate !== null,
        );

      return {
        candidates,
        rateLimit,
      };
    },
  );

  return {
    searchUnit: input.unit,
    ...catalogueResult,
  };
}
