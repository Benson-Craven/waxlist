import "server-only";

export type ServerCapability =
  | "listenbrainzImport"
  | "discogsCatalogue"
  | "pressingProof"
  | "spotifyLegacyClaim"
  | "spotifyImport"
  | "youtubeLinks"
  | "youtubeWatchHistory"
  | "youtubeMusicLibrary"
  | "discogsCollectionSync"
  | "discogsMarketplace"
  | "sellerScout"
  | "discogsRestrictedData";

export const CAPABILITY_ENV_KEYS = {
  pressingProof: "WAXLIST_ENABLE_PRESSING_PROOF",
  spotifyImport: "WAXLIST_ENABLE_SPOTIFY_IMPORT",
  discogsCollectionSync: "WAXLIST_ENABLE_DISCOGS_COLLECTION_SYNC",
  discogsMarketplace: "WAXLIST_ENABLE_DISCOGS_MARKETPLACE",
  sellerScout: "WAXLIST_ENABLE_SELLER_SCOUT",
  discogsRestrictedData: "WAXLIST_ENABLE_DISCOGS_RESTRICTED_DATA",
} as const satisfies Partial<Record<ServerCapability, string>>;

export type ServerCapabilities = Record<ServerCapability, boolean>;

const CAPABILITY_LABELS = {
  listenbrainzImport: "ListenBrainz import",
  discogsCatalogue: "Discogs catalogue matching",
  pressingProof: "Pressing proof",
  spotifyLegacyClaim: "Spotify legacy-data claim",
  spotifyImport: "Spotify importing",
  youtubeLinks: "YouTube link intake",
  youtubeWatchHistory: "YouTube watch-history import",
  youtubeMusicLibrary: "YouTube Music library import",
  discogsCollectionSync: "Discogs collection sync",
  discogsMarketplace: "Discogs marketplace data",
  sellerScout: "Seller Scout",
  discogsRestrictedData: "Discogs Restricted Data",
} as const satisfies Record<ServerCapability, string>;

function isExplicitlyEnabled(key: string) {
  return process.env[key]?.trim().toLowerCase() === "true";
}

function isEnabledUnlessExplicitlyDisabled(key: string) {
  return process.env[key]?.trim().toLowerCase() !== "false";
}

export function getServerCapabilities(
  _untrustedOverrides?: never,
): ServerCapabilities {
  void _untrustedOverrides;
  return {
    listenbrainzImport: true,
    discogsCatalogue: true,
    pressingProof: isExplicitlyEnabled(CAPABILITY_ENV_KEYS.pressingProof),
    spotifyLegacyClaim: true,
    spotifyImport: isEnabledUnlessExplicitlyDisabled(
      CAPABILITY_ENV_KEYS.spotifyImport,
    ),
    youtubeLinks: true,
    youtubeWatchHistory: false,
    youtubeMusicLibrary: false,
    discogsCollectionSync: isExplicitlyEnabled(
      CAPABILITY_ENV_KEYS.discogsCollectionSync,
    ),
    discogsMarketplace: isExplicitlyEnabled(
      CAPABILITY_ENV_KEYS.discogsMarketplace,
    ),
    sellerScout: isExplicitlyEnabled(CAPABILITY_ENV_KEYS.sellerScout),
    discogsRestrictedData: isExplicitlyEnabled(
      CAPABILITY_ENV_KEYS.discogsRestrictedData,
    ),
  };
}

export function requireServerCapability(capability: ServerCapability) {
  if (getServerCapabilities()[capability]) {
    return {
      ok: true as const,
    };
  }

  return {
    ok: false as const,
    error: {
      code: "capability_disabled" as const,
      capability,
      message: `${CAPABILITY_LABELS[capability]} is not available in this WAXLIST build.`,
    },
  };
}
