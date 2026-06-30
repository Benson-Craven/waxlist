import type { SpotifyAlbumCandidate } from "@/lib/spotify/workspace";

export type DiscogsSearchUnit = {
  id: string;
  album: string;
  artist: string;
  normalizedAlbum: string;
  normalizedArtist: string;
  query: string;
  releaseYear: number | null;
  sourceTrackCount: number;
  sourceTrackNames: string[];
  spotifyAlbumId: string | null;
  spotifyAlbumUrl: string | null;
  isCompilation: boolean;
};

const NOISE_PATTERNS = [
  /\b(remaster(?:ed)?|deluxe|expanded|explicit|clean|radio edit)\b/gi,
  /\b(anniversary|bonus track(?:s)?|special edition)\b/gi,
];

export function normalizeForDiscogsSearch(value: string) {
  let normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ");

  for (const pattern of NOISE_PATTERNS) {
    normalized = normalized.replace(pattern, " ");
  }

  return normalized
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getReleaseYear(releaseDate: string | null) {
  if (!releaseDate) {
    return null;
  }

  const year = Number.parseInt(releaseDate.slice(0, 4), 10);

  return Number.isFinite(year) ? year : null;
}

export function createDiscogsSearchUnit(
  candidate: SpotifyAlbumCandidate,
): DiscogsSearchUnit {
  const normalizedAlbum = normalizeForDiscogsSearch(candidate.album);
  const normalizedArtist = normalizeForDiscogsSearch(candidate.primaryArtist);

  return {
    id: `${normalizedArtist}::${normalizedAlbum}`,
    album: candidate.album,
    artist: candidate.primaryArtist,
    normalizedAlbum,
    normalizedArtist,
    query: [candidate.primaryArtist, candidate.album].join(" "),
    releaseYear: getReleaseYear(candidate.releaseDate),
    sourceTrackCount: candidate.sourceTrackCount,
    sourceTrackNames: candidate.sourceTracks.map((track) => track.name),
    spotifyAlbumId: candidate.sourceTracks[0]?.albumId ?? null,
    spotifyAlbumUrl: candidate.albumExternalUrl,
    isCompilation: candidate.isCompilation,
  };
}

export function createDiscogsSearchUnits(
  candidates: SpotifyAlbumCandidate[],
): DiscogsSearchUnit[] {
  const units = new Map<string, DiscogsSearchUnit>();

  for (const candidate of candidates) {
    const unit = createDiscogsSearchUnit(candidate);
    const existingUnit = units.get(unit.id);

    if (!existingUnit) {
      units.set(unit.id, unit);
      continue;
    }

    units.set(unit.id, {
      ...existingUnit,
      sourceTrackCount: existingUnit.sourceTrackCount + unit.sourceTrackCount,
      sourceTrackNames: Array.from(
        new Set([...existingUnit.sourceTrackNames, ...unit.sourceTrackNames]),
      ),
      spotifyAlbumUrl: existingUnit.spotifyAlbumUrl ?? unit.spotifyAlbumUrl,
    });
  }

  return Array.from(units.values());
}
