import { apiCacheKeys, getOrSetApiCache } from "@/lib/cache/api-cache";
import type { DiscogsSearchUnit } from "@/lib/matching/discogs-search-units";
import type {
  PressingCandidate,
  PressingIdentifier,
} from "@/lib/pressing-detective/matching";

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
  checkedAt: string | null;
  freshForSeconds: number | null;
  lowestPrice: {
    value: number;
    currency: string;
  } | null;
};

export type DiscogsMarketplaceListing = {
  id: number;
  status: string | null;
  uri: string | null;
  resourceUrl: string | null;
  condition: string | null;
  sleeveCondition: string | null;
  comments: string | null;
  shipsFrom: string | null;
  price: {
    value: number;
    currency: string;
  } | null;
  shippingPrice: {
    value: number;
    currency: string;
  } | null;
  originalShippingPrice: {
    value: number;
    currency: string;
  } | null;
  shippingIsBlocked: boolean;
  seller: {
    username: string;
    stats: {
      rating: string | null;
      stars: number | null;
      total: number | null;
    } | null;
    minOrderTotal: number | null;
    shipping: string | null;
  } | null;
  release: {
    id: number | null;
    title: string | null;
  } | null;
};

export type DiscogsMarketplaceListingsPage = {
  releaseId: number;
  page: number;
  perPage: number;
  totalPages: number;
  totalItems: number;
  checkedAt: string;
  freshForSeconds: number | null;
  listings: DiscogsMarketplaceListing[];
  rateLimit: DiscogsRateLimit;
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
  mediaCondition: string | null;
  sleeveCondition: string | null;
};

export type DiscogsCollectionFieldMap = Map<number, string>;

export type DiscogsCollectionFields = {
  fields: DiscogsCollectionFieldMap;
  rateLimit: DiscogsRateLimit;
};

export type DiscogsCollectionPage = {
  page: number;
  perPage: number;
  totalPages: number;
  totalItems: number;
  releases: DiscogsCollectionRelease[];
  rateLimit: DiscogsRateLimit;
};

export type DiscogsMasterVersionsPage = {
  page: number;
  perPage: number;
  totalPages: number;
  totalItems: number;
  versions: PressingCandidate[];
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
    notes?: DiscogsCollectionNote[];
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

type DiscogsCollectionNote = {
  field_id?: number;
  field_name?: string;
  name?: string;
  value?: string;
  field?: {
    name?: string;
  };
};

type DiscogsCollectionFieldsResponse = {
  fields?: Array<{
    id?: number;
    field_id?: number;
    name?: string;
  }>;
};

type DiscogsMasterVersionsResponse = {
  pagination?: {
    page?: number;
    pages?: number;
    per_page?: number;
    items?: number;
  };
  versions?: Array<{
    id?: number;
    title?: string;
    thumb?: string;
    format?: string | string[];
    major_formats?: string[];
    label?: string;
    catno?: string;
    country?: string;
    released?: string;
    year?: number | string;
    resource_url?: string;
    uri?: string;
  }>;
};

type DiscogsReleaseDetailResponse = {
  id?: number;
  master_id?: number;
  title?: string;
  year?: number;
  released?: string;
  country?: string;
  thumb?: string;
  uri?: string;
  resource_url?: string;
  notes?: string;
  artists?: Array<{
    name?: string;
  }>;
  images?: Array<{
    uri?: string;
    uri150?: string;
    resource_url?: string;
    type?: string;
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
    description?: string;
  }>;
  companies?: Array<{
    name?: string;
    entity_type_name?: string;
  }>;
  extraartists?: Array<{
    name?: string;
    role?: string;
  }>;
};

type DiscogsMarketplaceStatsResponse = {
  num_for_sale?: number;
  lowest_price?: {
    value?: number;
    currency?: string;
  };
};

type DiscogsMarketplaceListingResponse = {
  id?: number;
  status?: string;
  uri?: string;
  resource_url?: string;
  condition?: string;
  sleeve_condition?: string;
  comments?: string;
  ships_from?: string;
  price?: {
    value?: number;
    currency?: string;
  };
  shipping_price?: {
    value?: number;
    currency?: string;
  };
  original_shipping_price?: {
    value?: number;
    currency?: string;
  };
  shipping_is_blocked?: boolean;
  seller?: {
    username?: string;
    stats?: {
      rating?: string;
      stars?: number;
      total?: number;
    };
    min_order_total?: number;
    shipping?: string;
  };
  release?: {
    id?: number;
    title?: string;
  };
};

type DiscogsMarketplaceSearchResponse = {
  pagination?: {
    page?: number;
    pages?: number;
    per_page?: number;
    items?: number;
  };
  listings?: DiscogsMarketplaceListingResponse[];
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

function cacheTtlSeconds(cacheTtlMs: number | undefined) {
  return typeof cacheTtlMs === "number" && Number.isFinite(cacheTtlMs)
    ? Math.max(0, Math.round(cacheTtlMs / 1000))
    : null;
}

function normalizeDiscogsMarketplaceStats(
  stats: Partial<DiscogsMarketplaceStats> | null,
  input: {
    releaseId: number;
    cacheTtlMs?: number;
  },
): DiscogsMarketplaceStats {
  const lowestPriceValue = stats?.lowestPrice?.value;
  const lowestPriceCurrency = stats?.lowestPrice?.currency;

  return {
    releaseId:
      typeof stats?.releaseId === "number" ? stats.releaseId : input.releaseId,
    numForSale:
      typeof stats?.numForSale === "number" ? stats.numForSale : null,
    checkedAt: typeof stats?.checkedAt === "string" ? stats.checkedAt : null,
    freshForSeconds:
      typeof stats?.freshForSeconds === "number"
        ? stats.freshForSeconds
        : cacheTtlSeconds(input.cacheTtlMs),
    lowestPrice:
      typeof lowestPriceValue === "number" && lowestPriceCurrency
        ? {
            value: lowestPriceValue,
            currency: lowestPriceCurrency,
          }
        : null,
  };
}

function normalizeMarketplacePrice(
  price: DiscogsMarketplaceListingResponse["price"],
) {
  const value = price?.value;
  const currency = price?.currency;

  return typeof value === "number" && typeof currency === "string" && currency
    ? {
        value,
        currency,
      }
    : null;
}

function normalizeDiscogsMarketplaceListing(
  listing: DiscogsMarketplaceListingResponse,
): DiscogsMarketplaceListing | null {
  if (typeof listing.id !== "number") {
    return null;
  }

  return {
    id: listing.id,
    status: firstCleanString([listing.status]),
    uri: firstCleanString([listing.uri]),
    resourceUrl: firstCleanString([listing.resource_url]),
    condition: firstCleanString([listing.condition]),
    sleeveCondition: firstCleanString([listing.sleeve_condition]),
    comments: firstCleanString([listing.comments]),
    shipsFrom: firstCleanString([listing.ships_from]),
    price: normalizeMarketplacePrice(listing.price),
    shippingPrice: normalizeMarketplacePrice(listing.shipping_price),
    originalShippingPrice: normalizeMarketplacePrice(
      listing.original_shipping_price,
    ),
    shippingIsBlocked: listing.shipping_is_blocked === true,
    seller:
      typeof listing.seller?.username === "string" && listing.seller.username
        ? {
            username: listing.seller.username,
            stats: listing.seller.stats
              ? {
                  rating: firstCleanString([listing.seller.stats.rating]),
                  stars:
                    typeof listing.seller.stats.stars === "number"
                      ? listing.seller.stats.stars
                      : null,
                  total:
                    typeof listing.seller.stats.total === "number"
                      ? listing.seller.stats.total
                      : null,
                }
              : null,
            minOrderTotal:
              typeof listing.seller.min_order_total === "number"
                ? listing.seller.min_order_total
                : null,
            shipping: firstCleanString([listing.seller.shipping]),
          }
        : null,
    release: listing.release
      ? {
          id:
            typeof listing.release.id === "number" ? listing.release.id : null,
          title: firstCleanString([listing.release.title]),
        }
      : null,
  };
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

function normalizeConditionFieldName(value: string | null) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getCollectionNoteFieldName(
  note: DiscogsCollectionNote,
  fieldNames: DiscogsCollectionFieldMap | null | undefined,
) {
  return (
    firstCleanString([note.field_name, note.name, note.field?.name]) ??
    (typeof note.field_id === "number" ? fieldNames?.get(note.field_id) ?? null : null)
  );
}

function getConditionNoteValue(
  notes: DiscogsCollectionNote[] | undefined,
  fieldNames: DiscogsCollectionFieldMap | null | undefined,
  conditionType: "media" | "sleeve",
) {
  for (const note of notes ?? []) {
    const fieldName = normalizeConditionFieldName(
      getCollectionNoteFieldName(note, fieldNames),
    );

    if (
      fieldName.includes(conditionType) &&
      fieldName.includes("condition")
    ) {
      return firstCleanString([note.value]);
    }
  }

  return null;
}

function uniqueCleanStrings(values: Array<unknown>) {
  return Array.from(
    new Set(
      values
        .filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0,
        )
        .map((value) => value.trim()),
    ),
  );
}

function parseDiscogsYear(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === "number" && Number.isInteger(value) && value > 0) {
      return value;
    }

    if (typeof value === "string") {
      const match = value.match(/\b(19|20)\d{2}\b/);

      if (match) {
        const parsed = Number.parseInt(match[0], 10);

        if (Number.isInteger(parsed) && parsed > 0) {
          return parsed;
        }
      }
    }
  }

  return null;
}

function normalizeDiscogsFormat(
  formats: Array<{
    name?: string;
    descriptions?: string[];
  }> = [],
) {
  return uniqueCleanStrings(
    formats.flatMap((formatEntry) => [
      formatEntry.name,
      ...(formatEntry.descriptions ?? []),
    ]),
  );
}

function parseVersionFormat(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return uniqueCleanStrings(value);
  }

  if (typeof value !== "string") {
    return [];
  }

  return uniqueCleanStrings(value.split(",").map((entry) => entry.trim()));
}

function normalizeDiscogsIdentifier(
  identifier: NonNullable<DiscogsReleaseDetailResponse["identifiers"]>[number],
): PressingIdentifier | null {
  const type = firstCleanString([identifier.type]);
  const value = firstCleanString([identifier.value]);

  if (!type || !value) {
    return null;
  }

  return {
    type,
    value,
    description: firstCleanString([identifier.description]),
  };
}

function getDiscogsUri(value: string | undefined | null, releaseId: number) {
  if (value?.startsWith("http")) {
    return value;
  }

  if (value?.startsWith("/")) {
    return `https://www.discogs.com${value}`;
  }

  return `https://www.discogs.com/release/${releaseId}`;
}

function normalizeMasterVersionCandidate(
  version: NonNullable<DiscogsMasterVersionsResponse["versions"]>[number],
  masterId: number,
): PressingCandidate | null {
  const releaseId = version.id;
  const title = firstCleanString([version.title]);

  if (!releaseId || !title) {
    return null;
  }

  const formats = uniqueCleanStrings([
    ...parseVersionFormat(version.format),
    ...(version.major_formats ?? []),
  ]);
  const catalogNumber = firstCleanString([version.catno]);
  const label = firstCleanString([version.label]);

  return {
    id: releaseId,
    masterId,
    title,
    artist: null,
    country: firstCleanString([version.country]),
    year: parseDiscogsYear(version.year, version.released),
    formats,
    labels: label ? [label] : [],
    catalogNumbers: catalogNumber ? [catalogNumber] : [],
    barcodes: [],
    matrixRunouts: [],
    pressingPlants: [],
    masteringCredits: [],
    identifiers: [],
    notes: null,
    imageUrl: firstCleanString([version.thumb]),
    uri: getDiscogsUri(version.uri, releaseId),
    resourceUrl: firstCleanString([version.resource_url]),
    detailLoaded: false,
  };
}

function normalizeReleaseDetailCandidate(
  release: DiscogsReleaseDetailResponse,
): PressingCandidate | null {
  const releaseId = release.id;
  const title = firstCleanString([release.title]);

  if (!releaseId || !title) {
    return null;
  }

  const identifiers = (release.identifiers ?? [])
    .map(normalizeDiscogsIdentifier)
    .filter((identifier): identifier is PressingIdentifier => Boolean(identifier));
  const labels = uniqueCleanStrings(
    (release.labels ?? []).map((label) => label.name),
  );
  const catalogNumbers = uniqueCleanStrings(
    (release.labels ?? []).map((label) => label.catno),
  );
  const lowerTypeIncludes = (identifier: PressingIdentifier, needle: string) =>
    identifier.type.toLowerCase().includes(needle);
  const barcodes = uniqueCleanStrings(
    identifiers
      .filter((identifier) => lowerTypeIncludes(identifier, "barcode"))
      .map((identifier) => identifier.value),
  );
  const matrixRunouts = uniqueCleanStrings(
    identifiers
      .filter(
        (identifier) =>
          lowerTypeIncludes(identifier, "matrix") ||
          lowerTypeIncludes(identifier, "runout"),
      )
      .map((identifier) => identifier.value),
  );
  const pressingPlants = uniqueCleanStrings(
    (release.companies ?? [])
      .filter((company) => {
        const role = company.entity_type_name?.toLowerCase() ?? "";

        return (
          role.includes("pressed") ||
          role.includes("manufactured") ||
          role.includes("made by")
        );
      })
      .map((company) => company.name),
  );
  const masteringCredits = uniqueCleanStrings(
    (release.extraartists ?? [])
      .filter((artist) => {
        const role = artist.role?.toLowerCase() ?? "";

        return (
          role.includes("master") ||
          role.includes("lacquer") ||
          role.includes("cut")
        );
      })
      .map((artist) =>
        artist.role && artist.name ? `${artist.name} (${artist.role})` : artist.name,
      ),
  );
  const primaryImage =
    release.images?.find((image) => image.type === "primary") ??
    release.images?.[0];

  return {
    id: releaseId,
    masterId: release.master_id ?? null,
    title,
    artist: firstCleanString(release.artists?.map((artist) => artist.name) ?? []),
    country: firstCleanString([release.country]),
    year: parseDiscogsYear(release.year, release.released),
    formats: normalizeDiscogsFormat(release.formats),
    labels,
    catalogNumbers,
    barcodes,
    matrixRunouts,
    pressingPlants,
    masteringCredits,
    identifiers,
    notes: firstCleanString([release.notes]),
    imageUrl: firstCleanString([
      primaryImage?.uri150,
      primaryImage?.resource_url,
      primaryImage?.uri,
      release.thumb,
    ]),
    uri: getDiscogsUri(release.uri, releaseId),
    resourceUrl: firstCleanString([release.resource_url]),
    detailLoaded: true,
  };
}

function normalizeDiscogsCollectionRelease(
  item: NonNullable<DiscogsCollectionResponse["releases"]>[number],
  fieldNames?: DiscogsCollectionFieldMap | null,
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
    mediaCondition: getConditionNoteValue(item.notes, fieldNames, "media"),
    sleeveCondition: getConditionNoteValue(item.notes, fieldNames, "sleeve"),
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

export async function getDiscogsCollectionFields(input: {
  username: string;
  token: string;
  userAgent: string;
}): Promise<DiscogsCollectionFields> {
  const response = await fetch(
    `https://api.discogs.com/users/${encodeURIComponent(
      input.username,
    )}/collection/fields`,
    {
      headers: authHeaders(input),
      cache: "no-store",
    },
  );
  const rateLimit = readDiscogsRateLimit(response.headers);

  if (!response.ok) {
    throw await createDiscogsApiError(response);
  }

  const payload = (await response.json()) as DiscogsCollectionFieldsResponse;
  const fields = new Map<number, string>();

  for (const field of payload.fields ?? []) {
    const id = field.id ?? field.field_id;
    const name = firstCleanString([field.name]);

    if (typeof id === "number" && name) {
      fields.set(id, name);
    }
  }

  return {
    fields,
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
  fieldNames?: DiscogsCollectionFieldMap | null;
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
      .map((release) =>
        normalizeDiscogsCollectionRelease(release, input.fieldNames),
      )
      .filter((release): release is DiscogsCollectionRelease => Boolean(release)),
    rateLimit,
  };
}

export async function getDiscogsMasterVersions(input: {
  masterId: number;
  page: number;
  perPage: number;
  token: string;
  userAgent: string;
  cacheTtlMs?: number;
}): Promise<DiscogsMasterVersionsPage> {
  return getOrSetApiCache(
    apiCacheKeys.discogsMasterVersions(
      input.masterId,
      input.page,
      input.perPage,
    ),
    input.cacheTtlMs ?? 0,
    async () => {
      const searchParams = new URLSearchParams({
        page: String(input.page),
        per_page: String(input.perPage),
      });
      const response = await fetch(
        `https://api.discogs.com/masters/${input.masterId}/versions?${searchParams}`,
        {
          headers: authHeaders(input),
          cache: "no-store",
        },
      );
      const rateLimit = readDiscogsRateLimit(response.headers);

      if (!response.ok) {
        throw await createDiscogsApiError(response);
      }

      const payload = (await response.json()) as DiscogsMasterVersionsResponse;
      const pagination = payload.pagination ?? {};

      return {
        page: pagination.page ?? input.page,
        perPage: pagination.per_page ?? input.perPage,
        totalPages: pagination.pages ?? input.page,
        totalItems: pagination.items ?? payload.versions?.length ?? 0,
        versions: (payload.versions ?? [])
          .map((version) =>
            normalizeMasterVersionCandidate(version, input.masterId),
          )
          .filter((version): version is PressingCandidate => Boolean(version)),
        rateLimit,
      };
    },
  );
}

export async function getDiscogsReleaseDetail(input: {
  releaseId: number;
  token: string;
  userAgent: string;
  cacheTtlMs?: number;
}): Promise<PressingCandidate> {
  return getOrSetApiCache(
    apiCacheKeys.discogsRelease(input.releaseId),
    input.cacheTtlMs ?? 0,
    async () => {
      const response = await fetch(
        `https://api.discogs.com/releases/${input.releaseId}`,
        {
          headers: authHeaders(input),
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw await createDiscogsApiError(response);
      }

      const payload = (await response.json()) as DiscogsReleaseDetailResponse;
      const candidate = normalizeReleaseDetailCandidate(payload);

      if (!candidate) {
        throw new DiscogsApiError({
          code: "discogs_provider_error",
          message: "Discogs release detail did not include usable release data.",
          status: 502,
          retryAfterSeconds: null,
          rateLimit: readDiscogsRateLimit(response.headers),
          providerMessage: null,
        });
      }

      return candidate;
    },
  );
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

export async function searchDiscogsMarketplaceListings(input: {
  releaseId: number;
  token: string;
  userAgent: string;
  page?: number;
  perPage?: number;
  cacheTtlMs?: number;
}): Promise<DiscogsMarketplaceListingsPage> {
  const page = input.page ?? 1;
  const perPage = input.perPage ?? 5;

  return getOrSetApiCache(
    apiCacheKeys.discogsMarketplaceListings(input.releaseId, page, perPage),
    input.cacheTtlMs ?? 0,
    async () => {
      const searchParams = new URLSearchParams({
        release_id: String(input.releaseId),
        page: String(page),
        per_page: String(perPage),
      });
      const response = await fetch(
        `https://api.discogs.com/marketplace/search?${searchParams}`,
        {
          headers: authHeaders(input),
          cache: "no-store",
        },
      );
      const rateLimit = readDiscogsRateLimit(response.headers);

      if (!response.ok) {
        throw await createDiscogsApiError(response);
      }

      const payload = (await response.json()) as DiscogsMarketplaceSearchResponse;
      const pagination = payload.pagination ?? {};

      return {
        releaseId: input.releaseId,
        page: pagination.page ?? page,
        perPage: pagination.per_page ?? perPage,
        totalPages: pagination.pages ?? page,
        totalItems: pagination.items ?? payload.listings?.length ?? 0,
        checkedAt: new Date().toISOString(),
        freshForSeconds: cacheTtlSeconds(input.cacheTtlMs),
        listings: (payload.listings ?? [])
          .map(normalizeDiscogsMarketplaceListing)
          .filter((listing): listing is DiscogsMarketplaceListing =>
            Boolean(listing),
          ),
        rateLimit,
      };
    },
  );
}

export async function getDiscogsMarketplaceStats(input: {
  releaseId: number;
  token: string;
  userAgent: string;
  cacheTtlMs?: number;
}): Promise<DiscogsMarketplaceStats> {
  const stats = await getOrSetApiCache(
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
      const checkedAt = new Date().toISOString();

      return {
        releaseId: input.releaseId,
        numForSale:
          typeof payload.num_for_sale === "number" ? payload.num_for_sale : null,
        checkedAt,
        freshForSeconds: cacheTtlSeconds(input.cacheTtlMs),
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

  return normalizeDiscogsMarketplaceStats(stats, input);
}
