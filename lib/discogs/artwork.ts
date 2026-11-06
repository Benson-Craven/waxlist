/**
 * Picks the sharpest Discogs artwork a payload already carries.
 *
 * Discogs serves every image from `i.discogs.com` through a signed transform
 * path, so a rendition URL cannot be upgraded by editing its query or path
 * parameters: a 150px signature only returns 150px (anything else is a 403).
 * The large rendition therefore has to be chosen from the payload before the
 * URL is stored.
 *
 * Release payloads expose both `uri`/`resource_url` (600px, `q:90`) and
 * `uri150` (150px, `q:40`). Search results expose `cover_image` (600px) and
 * `thumb` (150px). Prefer the large rendition everywhere.
 */

export type DiscogsImageVariant = {
  type?: string | null;
  uri?: string | null;
  uri150?: string | null;
  resource_url?: string | null;
  width?: number | null;
  height?: number | null;
};

export type DiscogsArtworkQuality = "large" | "thumbnail" | "unknown";

const DISCOGS_IMAGE_HOST = "i.discogs.com";
const THUMBNAIL_TRANSFORM_PATTERN = /\/[wh]:150\/[wh]:150\//;
const LARGE_TRANSFORM_PATTERN = /\/[wh]:(?:[4-9]\d{2}|\d{4,})\//;

function cleanUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);

    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

/**
 * True when the URL points at a Discogs 150px thumbnail rendition rather than
 * the 600px release artwork.
 */
export function isDiscogsThumbnailUrl(value: unknown): boolean {
  const url = cleanUrl(value);

  if (!url) {
    return false;
  }

  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.hostname !== DISCOGS_IMAGE_HOST) {
    return false;
  }

  return THUMBNAIL_TRANSFORM_PATTERN.test(parsed.pathname);
}

export function discogsArtworkQuality(value: unknown): DiscogsArtworkQuality {
  const url = cleanUrl(value);

  if (!url) {
    return "unknown";
  }

  if (isDiscogsThumbnailUrl(url)) {
    return "thumbnail";
  }

  try {
    const parsed = new URL(url);

    if (parsed.hostname !== DISCOGS_IMAGE_HOST) {
      return "unknown";
    }

    return LARGE_TRANSFORM_PATTERN.test(parsed.pathname) ? "large" : "unknown";
  } catch {
    return "unknown";
  }
}

function imageArea(image: DiscogsImageVariant): number {
  const width = typeof image.width === "number" ? image.width : 0;
  const height = typeof image.height === "number" ? image.height : 0;

  return width > 0 && height > 0 ? width * height : 0;
}

function scoreCandidate(input: {
  image: DiscogsImageVariant;
  url: string;
  fromVariantField: boolean;
}): number {
  let score = 0;

  // A primary image is the sleeve Discogs shows first; secondary images are
  // usually inner sleeves or labels.
  if (input.image.type === "primary") {
    score += 1000;
  }

  // `uri`/`resource_url` are the large renditions; `uri150` is the thumbnail.
  if (input.fromVariantField) {
    score += 100;
  }

  if (!isDiscogsThumbnailUrl(input.url)) {
    score += 50;
  }

  const area = imageArea(input.image);

  if (area > 0) {
    score += Math.min(40, Math.round(Math.sqrt(area) / 25));
  }

  return score;
}

type ScoredCandidate = {
  url: string;
  score: number;
};

/**
 * Returns the best artwork URL from a release/search image list, falling back
 * to a single URL when the payload has no image array.
 *
 * Never returns a thumbnail while a large rendition is available.
 */
export function pickDiscogsArtworkUrl(
  images: Array<DiscogsImageVariant | null | undefined> | null | undefined,
  fallback: string | null | undefined = null,
): string | null {
  const candidates: ScoredCandidate[] = [];

  for (const image of images ?? []) {
    if (!image) {
      continue;
    }

    const variantUrls: Array<{ value: unknown; fromVariantField: boolean }> = [
      { value: image.uri, fromVariantField: true },
      { value: image.resource_url, fromVariantField: true },
      { value: image.uri150, fromVariantField: false },
    ];

    for (const variant of variantUrls) {
      const url = cleanUrl(variant.value);

      if (!url) {
        continue;
      }

      candidates.push({
        url,
        score: scoreCandidate({
          image,
          url,
          fromVariantField: variant.fromVariantField,
        }),
      });
    }
  }

  const bestByUrl = new Map<string, number>();

  for (const candidate of candidates) {
    const previous = bestByUrl.get(candidate.url) ?? -1;

    if (candidate.score > previous) {
      bestByUrl.set(candidate.url, candidate.score);
    }
  }

  let bestUrl: string | null = null;
  let bestScore = -1;

  for (const [url, score] of bestByUrl) {
    if (score > bestScore) {
      bestUrl = url;
      bestScore = score;
    }
  }

  if (bestUrl) {
    return bestUrl;
  }

  return cleanUrl(fallback);
}
