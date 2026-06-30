export type WishlistPriority = "low" | "medium" | "high" | "grail";

export type IgnoredListingState = "none" | "ignored" | "watch_relist";

export type WishlistBuyingControls = {
  priority: WishlistPriority | null;
  tags: string[];
  maxItemPrice: string | null;
  maxShipping: string | null;
  conditionPreference: string | null;
  sellerFilter: string | null;
  regionFilter: string | null;
  ignoredListingState: IgnoredListingState;
  ignoredListingNote: string | null;
  updatedAt: string | null;
};

export type WishlistRecord = {
  id: string;
  savedAt: string;
  spotifyAlbum: string;
  spotifyArtist: string;
  spotifyAlbumId: string | null;
  spotifyAlbumUrl: string | null;
  discogsReleaseId: number;
  discogsTitle: string;
  discogsArtist: string;
  discogsUri: string | null;
  thumb: string | null;
  format: string[];
  year: number | null;
  country: string | null;
  recommendationScore: number;
  confidence: number;
  availabilityLabel: string;
  priceLabel: string;
  sourceTrackCount: number;
  buyingControls: WishlistBuyingControls;
};

const DEFAULT_BUYING_CONTROLS: WishlistBuyingControls = {
  priority: null,
  tags: [],
  maxItemPrice: null,
  maxShipping: null,
  conditionPreference: null,
  sellerFilter: null,
  regionFilter: null,
  ignoredListingState: "none",
  ignoredListingNote: null,
  updatedAt: null,
};

function nullableString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function normalizePriority(value: unknown): WishlistPriority | null {
  return value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "grail"
    ? value
    : null;
}

function normalizeIgnoredListingState(value: unknown): IgnoredListingState {
  return value === "ignored" || value === "watch_relist" ? value : "none";
}

export function normalizeWishlistBuyingControls(
  value: unknown,
): WishlistBuyingControls {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_BUYING_CONTROLS };
  }

  const controls = value as Partial<WishlistBuyingControls>;

  return {
    priority: normalizePriority(controls.priority),
    tags: stringList(controls.tags),
    maxItemPrice: nullableString(controls.maxItemPrice),
    maxShipping: nullableString(controls.maxShipping),
    conditionPreference: nullableString(controls.conditionPreference),
    sellerFilter: nullableString(controls.sellerFilter),
    regionFilter: nullableString(controls.regionFilter),
    ignoredListingState: normalizeIgnoredListingState(
      controls.ignoredListingState,
    ),
    ignoredListingNote: nullableString(controls.ignoredListingNote),
    updatedAt: nullableString(controls.updatedAt),
  };
}

export function normalizeWishlistRecord(value: unknown): WishlistRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Partial<WishlistRecord>;

  if (
    typeof record.id !== "string" ||
    typeof record.savedAt !== "string" ||
    typeof record.spotifyAlbum !== "string" ||
    typeof record.spotifyArtist !== "string" ||
    typeof record.discogsReleaseId !== "number" ||
    typeof record.discogsTitle !== "string"
  ) {
    return null;
  }

  return {
    id: record.id,
    savedAt: record.savedAt,
    spotifyAlbum: record.spotifyAlbum,
    spotifyArtist: record.spotifyArtist,
    spotifyAlbumId: nullableString(record.spotifyAlbumId),
    spotifyAlbumUrl: nullableString(record.spotifyAlbumUrl),
    discogsReleaseId: record.discogsReleaseId,
    discogsTitle: record.discogsTitle,
    discogsArtist:
      typeof record.discogsArtist === "string"
        ? record.discogsArtist
        : record.spotifyArtist,
    discogsUri: nullableString(record.discogsUri),
    thumb: nullableString(record.thumb),
    format: Array.isArray(record.format)
      ? record.format.filter(
          (format): format is string => typeof format === "string",
        )
      : [],
    year: nullableNumber(record.year),
    country: nullableString(record.country),
    recommendationScore:
      typeof record.recommendationScore === "number"
        ? record.recommendationScore
        : 0,
    confidence: typeof record.confidence === "number" ? record.confidence : 0,
    availabilityLabel:
      typeof record.availabilityLabel === "string"
        ? record.availabilityLabel
        : "Availability unknown",
    priceLabel:
      typeof record.priceLabel === "string" ? record.priceLabel : "Price unknown",
    sourceTrackCount:
      typeof record.sourceTrackCount === "number" ? record.sourceTrackCount : 0,
    buyingControls: normalizeWishlistBuyingControls(record.buyingControls),
  };
}
