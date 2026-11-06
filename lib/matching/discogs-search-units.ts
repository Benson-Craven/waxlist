import type { SpotifyAlbumCandidate } from "@/lib/spotify/workspace";
import type {
  ListeningAlbumCandidate,
  ListeningSourceProvider,
} from "@/lib/listening/types";

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
  source: {
    provider: ListeningSourceProvider;
    albumId: string | null;
    albumUrl: string | null;
  };
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
    source: {
      provider: "spotify",
      albumId: candidate.sourceTracks[0]?.albumId ?? null,
      albumUrl: candidate.albumExternalUrl,
    },
    isCompilation: candidate.isCompilation,
  };
}

export function createDiscogsSearchUnitFromListeningCandidate(
  candidate: ListeningAlbumCandidate,
): DiscogsSearchUnit {
  return {
    id: candidate.id,
    album: candidate.album,
    artist: candidate.artist,
    normalizedAlbum: normalizeForDiscogsSearch(candidate.album),
    normalizedArtist: normalizeForDiscogsSearch(candidate.artist),
    query: [candidate.artist, candidate.album].filter(Boolean).join(" "),
    releaseYear: candidate.releaseYear,
    sourceTrackCount: candidate.evidenceCount,
    sourceTrackNames: candidate.trackEvidence.map((track) => track.name),
    source: {
      provider: candidate.provider,
      albumId:
        candidate.sourceIdentifiers.releaseGroupMbids[0] ??
        candidate.sourceIdentifiers.releaseMbids[0] ??
        candidate.sourceIdentifiers.youtubeVideoIds[0] ??
        null,
      albumUrl: candidate.sourceIdentifiers.sourceUrls[0] ?? null,
    },
    isCompilation: false,
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
      source: {
        ...existingUnit.source,
        albumUrl:
          existingUnit.source.albumUrl ?? unit.source.albumUrl,
      },
    });
  }

  return Array.from(units.values());
}
