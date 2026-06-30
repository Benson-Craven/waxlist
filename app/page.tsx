import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { Button } from "@/components/ui/button";
import { ConnectedWorkspace } from "@/components/spotify/connected-workspace";
import {
  SPOTIFY_AUTH_REFRESH_PATH,
  HOME_PAGE_COPY,
  SPOTIFY_AUTH_LOGOUT_PATH,
  SPOTIFY_AUTH_START_PATH,
  SPOTIFY_SESSION_COOKIE,
} from "@/lib/constants";
import { LiquidGradientCanvas } from "@/components/ui/liquid-gradient";
import { appConfig, getSessionSecretEnv } from "@/lib/config";
import {
  decodeSpotifySession,
  shouldRefreshSpotifySession,
} from "@/lib/spotify/oauth";
import { loadSpotifyWorkspaceSnapshot } from "@/lib/spotify/workspace";

const LANDING_GRADIENT_PRESETS = {
  sunset: {
    colors: ["#3b0f6f", "#8b2fc9", "#e84a8a", "#ffae5c"],
    speed: 0.6,
    scale: 0.5,
    seed: 8,
    turbAmp: 0.5,
    turbFreq: 0.6,
    turbIter: 8,
    waveFreq: 2.5,
    distBias: 0.1,
    ditherMode: "smooth",
    dither: 0.06,
    exposure: 1.2,
    contrast: 1.15,
    saturation: 1.1,
  },
  subtleDark: {
    colors: ["#050505", "#0f0f0f", "#0a0a0a", "#1a1a1a", "#141414"],
    speed: 1.0,
    scale: 0.4,
    seed: 3,
    turbAmp: 0.5,
    turbFreq: 0.6,
    turbIter: 8,
    waveFreq: 2.5,
    distBias: 0,
    ditherMode: "off",
    dither: 0.06,
    exposure: 1.1,
    contrast: 1.1,
    saturation: 1.0,
  },
  vibrant: {
    colors: ["#ff0055", "#0055ff", "#00ffaa", "#ffaa00", "#7700ff"],
    speed: 0.6,
    scale: 0.5,
    seed: 42,
    turbAmp: 0.5,
    turbFreq: 0.6,
    turbIter: 8,
    waveFreq: 2.5,
    distBias: 0.1,
    ditherMode: "smooth",
    dither: 0.06,
    exposure: 1.2,
    contrast: 1.2,
    saturation: 1.2,
  },
  aurora: {
    colors: ["#051105", "#0a3311", "#055533", "#11aa44", "#0a1122"],
    speed: 0.4,
    scale: 0.6,
    seed: 12,
    turbAmp: 0.6,
    turbFreq: 0.8,
    turbIter: 10,
    waveFreq: 1.5,
    distBias: -0.2,
    ditherMode: "grain",
    dither: 0.04,
    exposure: 1.3,
    contrast: 1.15,
    saturation: 1.1,
  },
  magma: {
    colors: ["#110000", "#330500", "#661100", "#aa3300", "#ff6600"],
    speed: 0.8,
    scale: 0.3,
    seed: 7,
    turbAmp: 0.5,
    turbFreq: 0.6,
    turbIter: 8,
    waveFreq: 3.0,
    distBias: 0.3,
    ditherMode: "smooth",
    dither: 0.06,
    exposure: 1.2,
    contrast: 1.3,
    saturation: 1.3,
  },
} as const;

type LandingGradientPresetName = keyof typeof LANDING_GRADIENT_PRESETS;

const DEFAULT_LANDING_GRADIENT_PRESET =
  "sunset" satisfies LandingGradientPresetName;

function SpotifyLogo() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5 shrink-0"
      fill="#1DB954"
    >
      <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0Zm5.5 17.3a.75.75 0 0 1-1.03.25c-2.82-1.72-6.38-2.11-10.57-1.16a.75.75 0 1 1-.33-1.46c4.59-1.05 8.53-.59 11.68 1.33.35.21.47.68.25 1.04Zm1.46-3.25a.94.94 0 0 1-1.29.31c-3.23-1.99-8.16-2.56-11.98-1.4a.94.94 0 0 1-.55-1.8c4.36-1.32 9.78-.68 13.5 1.61.45.27.59.85.32 1.28Zm.12-3.39C15.2 8.36 8.8 8.15 5.08 9.3a1.12 1.12 0 1 1-.66-2.15c4.27-1.31 11.34-1.06 15.81 1.59a1.12 1.12 0 0 1-1.15 1.92Z" />
    </svg>
  );
}

function getFirstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getLandingGradientPreset(value: string | string[] | undefined) {
  const requestedPreset = getFirstSearchParam(value);

  if (requestedPreset && requestedPreset in LANDING_GRADIENT_PRESETS) {
    return {
      name: requestedPreset as LandingGradientPresetName,
      params:
        LANDING_GRADIENT_PRESETS[requestedPreset as LandingGradientPresetName],
    };
  }

  return {
    name: DEFAULT_LANDING_GRADIENT_PRESET,
    params: LANDING_GRADIENT_PRESETS[DEFAULT_LANDING_GRADIENT_PRESET],
  };
}

function isSpotifyConnected(searchParams: { spotify?: string | string[] }) {
  return getFirstSearchParam(searchParams.spotify) === "connected";
}

function getSpotifyRedirectOrigin() {
  try {
    return new URL(appConfig.spotifyRedirectUri).origin;
  } catch {
    return null;
  }
}

function getSpotifyStatusMessage(
  searchParams: {
    spotify?: string | string[];
    missing?: string | string[];
    reason?: string | string[];
  },
  hasSpotifySession: boolean,
) {
  const spotifyStatus = getFirstSearchParam(searchParams.spotify);
  const missing = getFirstSearchParam(searchParams.missing);
  const reason = getFirstSearchParam(searchParams.reason);

  if (spotifyStatus === "configuration_error") {
    const missingLabel = missing
      ? ` Missing: ${missing.split(",").join(", ")}.`
      : "";

    return `Spotify setup is incomplete. Add the required Spotify credentials and session secret to .env.local, then restart the dev server.${missingLabel}`;
  }

  if (spotifyStatus === "error") {
    if (
      reason === "session_expired" ||
      reason === "session_missing" ||
      reason === "session_refresh_failed" ||
      reason === "invalid_grant"
    ) {
      return "Spotify session expired or could not be refreshed. Connect Spotify again.";
    }

    if (reason === "session_configuration_error") {
      return "Spotify session setup is incomplete. Check SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URI, and SESSION_SECRET in .env.local, then restart the dev server.";
    }

    if (reason === "invalid_state") {
      return "Spotify connection lost its session check. Open WAXLIST at http://127.0.0.1:3000 and try connecting again.";
    }

    if (reason === "token_exchange_failed") {
      return "Spotify approved access, but WAXLIST could not finish the token exchange. Check the Spotify client secret and redirect URI.";
    }

    return "Spotify connection did not complete. Try connecting again.";
  }

  if (spotifyStatus === "connected" && hasSpotifySession) {
    return "Spotify connected. Playlist import comes next.";
  }

  if (spotifyStatus === "connected") {
    const spotifyRedirectOrigin = getSpotifyRedirectOrigin();

    return spotifyRedirectOrigin
      ? `Spotify connected on ${spotifyRedirectOrigin}. Open that address to load your playlists.`
      : "Spotify connected, but the local browser host does not have the Spotify session cookie.";
  }

  if (spotifyStatus === "disconnected") {
    return "Spotify disconnected.";
  }

  if (hasSpotifySession) {
    return "Spotify connected. Playlist import comes next.";
  }
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    spotify?: string | string[];
    missing?: string | string[];
    reason?: string | string[];
    gradient?: string | string[];
  }>;
}) {
  const [resolvedSearchParams, cookieStore] = await Promise.all([
    searchParams,
    cookies(),
  ]);
  const sessionCookieValue = cookieStore.get(SPOTIFY_SESSION_COOKIE)?.value;
  const sessionSecret = sessionCookieValue ? getSessionSecretEnv() : null;
  const spotifySession =
    sessionCookieValue && sessionSecret?.ok
      ? decodeSpotifySession(sessionCookieValue, sessionSecret.secret)
      : undefined;
  const hasSpotifySession = Boolean(spotifySession);
  const spotifyConnectedParam = isSpotifyConnected(resolvedSearchParams);
  const requestHeaders = await headers();
  const requestHost = requestHeaders.get("host");
  const spotifyRedirectOrigin = getSpotifyRedirectOrigin();

  if (spotifyConnectedParam && !hasSpotifySession && spotifyRedirectOrigin) {
    const spotifyRedirectHost = new URL(spotifyRedirectOrigin).host;

    if (requestHost && requestHost !== spotifyRedirectHost) {
      redirect(`${spotifyRedirectOrigin}/?spotify=connected`);
    }
  }

  const showConnectedState = hasSpotifySession;

  if (spotifySession && shouldRefreshSpotifySession(spotifySession)) {
    redirect(SPOTIFY_AUTH_REFRESH_PATH);
  }

  const spotifyStatusMessage = getSpotifyStatusMessage(
    resolvedSearchParams,
    hasSpotifySession,
  );
  const initialWorkspace = showConnectedState
    ? await loadSpotifyWorkspaceSnapshot(sessionCookieValue)
    : null;
  const landingGradient = getLandingGradientPreset(
    resolvedSearchParams.gradient,
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <LiquidGradientCanvas
        key={landingGradient.name}
        colors={[...landingGradient.params.colors]}
        aria-hidden="true"
        speed={landingGradient.params.speed}
        scale={landingGradient.params.scale}
        seed={landingGradient.params.seed}
        turbAmp={landingGradient.params.turbAmp}
        turbFreq={landingGradient.params.turbFreq}
        turbIter={landingGradient.params.turbIter}
        waveFreq={landingGradient.params.waveFreq}
        distBias={landingGradient.params.distBias}
        ditherMode={landingGradient.params.ditherMode}
        dither={landingGradient.params.dither}
        exposure={landingGradient.params.exposure}
        contrast={landingGradient.params.contrast}
        saturation={landingGradient.params.saturation}
        fallbackColor={landingGradient.params.colors[0]}
        respectReducedMotion
        pauseWhenHidden
        className="absolute inset-0 h-full w-full"
      />

      <div className="absolute inset-0 bg-black/35" aria-hidden="true" />

      <section
        className={`relative z-10 flex min-h-screen flex-col items-center px-6 text-center ${
          showConnectedState
            ? "justify-start py-8 sm:py-10 lg:py-12"
            : "justify-center"
        }`}
        aria-labelledby="home-heading"
      >
        <p className="mb-5 text-xs uppercase tracking-[0.45em] text-white/60">
          {HOME_PAGE_COPY.eyebrow}
        </p>

        <h1
          id="home-heading"
          className="font-serif text-7xl italic tracking-tight text-white sm:text-8xl md:text-9xl"
        >
          {HOME_PAGE_COPY.title}
        </h1>

        <p className="mt-6 max-w-xl text-balance text-base text-white/75 sm:text-lg">
          {HOME_PAGE_COPY.tagline}
        </p>

        {showConnectedState ? null : (
          <Button
            asChild
            className="mt-10 cursor-pointer rounded-full px-8 py-6 text-base font-medium"
          >
            <a
              href={SPOTIFY_AUTH_START_PATH}
              aria-label="Connect Spotify to start building your vinyl crate"
            >
              <SpotifyLogo />
              {HOME_PAGE_COPY.cta}
            </a>
          </Button>
        )}

        {showConnectedState ? (
          <div className="mt-10 w-full max-w-6xl text-left">
            <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-white/10 bg-black/20 p-4 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/45">
                  Spotify connected
                </p>
                <p className="mt-2 text-sm text-white/65">
                  Select one playlist to start shaping your vinyl crate.
                </p>
              </div>
              <form action={SPOTIFY_AUTH_LOGOUT_PATH} method="post">
                <Button
                  type="submit"
                  variant="outline"
                  className="w-full cursor-pointer rounded-full border-white/15 bg-white/8 px-6 text-white hover:bg-white/15 sm:w-auto"
                >
                  Sign Out
                </Button>
              </form>
            </div>
            <ConnectedWorkspace initialWorkspace={initialWorkspace} />
          </div>
        ) : (
          <p className="mt-5 max-w-md text-balance text-xs leading-6 text-white/60 sm:text-sm">
            {HOME_PAGE_COPY.privacy}{" "}
            <Link
              href="/privacy"
              className="font-medium text-white/75 underline-offset-4 hover:text-white hover:underline"
            >
              {HOME_PAGE_COPY.privacyLinkLabel}
            </Link>
            {" · "}
            <Link
              href="/data-deletion"
              className="font-medium text-white/75 underline-offset-4 hover:text-white hover:underline"
            >
              {HOME_PAGE_COPY.deletionLinkLabel}
            </Link>
          </p>
        )}

        {spotifyStatusMessage ? (
          <p
            className="mt-4 max-w-md rounded-full border border-white/15 bg-black/25 px-4 py-2 text-balance text-xs leading-5 text-white/75 backdrop-blur-sm"
            role="status"
          >
            {spotifyStatusMessage}
          </p>
        ) : null}
      </section>
    </main>
  );
}
