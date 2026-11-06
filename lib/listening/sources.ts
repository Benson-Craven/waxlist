export const CRATE_SOURCES = [
  "spotify",
  "listenbrainz",
  "youtube",
] as const;

export type CrateSource = (typeof CRATE_SOURCES)[number];

export function getCrateSource(value: unknown): CrateSource {
  const requested = Array.isArray(value) ? value[0] : value;

  return typeof requested === "string" &&
    CRATE_SOURCES.includes(requested as CrateSource)
    ? (requested as CrateSource)
    : "spotify";
}

export function getCrateHref(source: CrateSource) {
  return `/app?view=crate&source=${source}`;
}
