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
};

function nullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
      ? record.format.filter((format): format is string => typeof format === "string")
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
  };
}
