export type MatchCorrection = {
  sourceKey: string;
  discogsReleaseId: number;
  sourceArtist: string;
  sourceAlbum: string;
  discogsTitle: string;
  createdAt: string;
};

export const MATCH_CORRECTIONS_STORAGE_KEY = "waxlist:match-corrections:v1";
export const MATCH_CORRECTIONS_CHANGED_EVENT =
  "waxlist:match-corrections-changed";

const MAX_CORRECTIONS = 200;

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined") {
      return null;
    }

    return window.localStorage;
  } catch {
    return null;
  }
}

export function matchCorrectionKey(sourceKey: string, releaseId: number) {
  return `${sourceKey}::${releaseId}`;
}

export function normalizeMatchCorrections(value: unknown): MatchCorrection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const corrections: MatchCorrection[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const candidate = entry as Record<string, unknown>;

    if (
      typeof candidate.sourceKey !== "string" ||
      candidate.sourceKey.trim().length === 0 ||
      typeof candidate.discogsReleaseId !== "number" ||
      !Number.isFinite(candidate.discogsReleaseId) ||
      typeof candidate.sourceArtist !== "string" ||
      typeof candidate.sourceAlbum !== "string" ||
      typeof candidate.discogsTitle !== "string" ||
      typeof candidate.createdAt !== "string"
    ) {
      continue;
    }

    const key = matchCorrectionKey(
      candidate.sourceKey,
      candidate.discogsReleaseId,
    );

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    corrections.push({
      sourceKey: candidate.sourceKey,
      discogsReleaseId: candidate.discogsReleaseId,
      sourceArtist: candidate.sourceArtist,
      sourceAlbum: candidate.sourceAlbum,
      discogsTitle: candidate.discogsTitle,
      createdAt: candidate.createdAt,
    });
  }

  return corrections.slice(0, MAX_CORRECTIONS);
}

export function parseMatchCorrectionsSnapshot(
  raw: string | null,
): MatchCorrection[] {
  if (!raw) {
    return [];
  }

  try {
    return normalizeMatchCorrections(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function getMatchCorrectionsSnapshot() {
  const storage = getStorage();

  if (!storage) {
    return "[]";
  }

  try {
    return storage.getItem(MATCH_CORRECTIONS_STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

export function getServerMatchCorrectionsSnapshot() {
  return "[]";
}

export function subscribeToMatchCorrections(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  function handleStorage(event: StorageEvent) {
    if (
      event.key !== null &&
      event.key !== MATCH_CORRECTIONS_STORAGE_KEY
    ) {
      return;
    }

    onStoreChange();
  }

  window.addEventListener("storage", handleStorage);
  window.addEventListener(MATCH_CORRECTIONS_CHANGED_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(
      MATCH_CORRECTIONS_CHANGED_EVENT,
      onStoreChange,
    );
  };
}

export function loadMatchCorrections(): MatchCorrection[] {
  const storage = getStorage();

  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(MATCH_CORRECTIONS_STORAGE_KEY);

    return raw ? normalizeMatchCorrections(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function persist(corrections: MatchCorrection[]) {
  const storage = getStorage();

  if (!storage) {
    return corrections;
  }

  try {
    storage.setItem(
      MATCH_CORRECTIONS_STORAGE_KEY,
      JSON.stringify(corrections),
    );
    window.dispatchEvent(new Event(MATCH_CORRECTIONS_CHANGED_EVENT));
  } catch {
    // A full or blocked storage area must not stop the correction in memory.
  }

  return corrections;
}

export function addMatchCorrection(
  correction: MatchCorrection,
): MatchCorrection[] {
  const key = matchCorrectionKey(
    correction.sourceKey,
    correction.discogsReleaseId,
  );
  const current = loadMatchCorrections().filter(
    (entry) =>
      matchCorrectionKey(entry.sourceKey, entry.discogsReleaseId) !== key,
  );

  return persist(normalizeMatchCorrections([correction, ...current]));
}

export function removeMatchCorrection(
  sourceKey: string,
  releaseId: number,
): MatchCorrection[] {
  const key = matchCorrectionKey(sourceKey, releaseId);

  return persist(
    loadMatchCorrections().filter(
      (entry) =>
        matchCorrectionKey(entry.sourceKey, entry.discogsReleaseId) !== key,
    ),
  );
}

export function isMatchCorrected(
  corrections: MatchCorrection[],
  sourceKey: string,
  releaseId: number,
) {
  const key = matchCorrectionKey(sourceKey, releaseId);

  return corrections.some(
    (entry) =>
      matchCorrectionKey(entry.sourceKey, entry.discogsReleaseId) === key,
  );
}

export function discogsSearchHref(correction: {
  sourceArtist: string;
  sourceAlbum: string;
}) {
  const query = `${correction.sourceArtist} ${correction.sourceAlbum}`.trim();

  return `https://www.discogs.com/search/?q=${encodeURIComponent(query)}&type=release&format=Vinyl`;
}
