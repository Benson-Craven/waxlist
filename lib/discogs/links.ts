/**
 * Public Discogs links. The release page is the catalogue record; the sell page
 * is the marketplace entry where a collector can actually buy a copy. Keep both
 * in one place so every surface links to the same destination.
 */
export function discogsReleaseUrl(releaseId: number): string {
  return `https://www.discogs.com/release/${releaseId}`;
}

export function discogsSellReleaseUrl(releaseId: number): string {
  return `https://www.discogs.com/sell/release/${releaseId}`;
}
