import { afterEach, describe, expect, test } from "vitest";

import {
  CAPABILITY_ENV_KEYS,
  getServerCapabilities,
  requireServerCapability,
} from "@/lib/capabilities/server";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("server capability registry", () => {
  test("enables beta source intake while restricted and future capabilities stay closed", () => {
    for (const key of Object.values(CAPABILITY_ENV_KEYS)) {
      delete process.env[key];
    }

    expect(getServerCapabilities()).toEqual({
      listenbrainzImport: true,
      discogsCatalogue: true,
      pressingProof: false,
      spotifyLegacyClaim: true,
      spotifyImport: true,
      youtubeLinks: true,
      youtubeWatchHistory: false,
      youtubeMusicLibrary: false,
      discogsCollectionSync: false,
      discogsMarketplace: false,
      sellerScout: false,
      discogsRestrictedData: false,
    });
  });

  test("does not accept client input as a capability override", () => {
    delete process.env[CAPABILITY_ENV_KEYS.discogsMarketplace];

    expect(
      getServerCapabilities({
        discogsMarketplace: true,
        sellerScout: true,
      } as never),
    ).toMatchObject({
      discogsMarketplace: false,
      sellerScout: false,
    });
  });

  test("returns a structured fail-closed error for disabled routes", () => {
    delete process.env[CAPABILITY_ENV_KEYS.sellerScout];

    expect(requireServerCapability("sellerScout")).toEqual({
      ok: false,
      error: {
        code: "capability_disabled",
        capability: "sellerScout",
        message: "Seller Scout is not available in this WAXLIST build.",
      },
    });
  });

  test("enables pressing proof only through its server environment gate", () => {
    process.env[CAPABILITY_ENV_KEYS.pressingProof] = "true";

    expect(getServerCapabilities().pressingProof).toBe(true);
  });
});
