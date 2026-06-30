import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { Button } from "@/components/ui/button";
import { ConnectedWorkspace } from "@/components/spotify/connected-workspace";
import {
  HOME_PAGE_COPY,
  SPOTIFY_AUTH_LOGOUT_PATH,
  SPOTIFY_AUTH_START_PATH,
  SPOTIFY_SESSION_COOKIE,
} from "@/lib/constants";
import {
  LiquidGradientCanvas,
  LIQUID_GRADIENT_PRESETS,
} from "@/components/ui/liquid-gradient";
import { appConfig } from "@/lib/config";
import { loadSpotifyWorkspaceSnapshot } from "@/lib/spotify/workspace";

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

    return `Spotify OAuth is not configured yet. Add the required Spotify credentials to .env.local.${missingLabel}`;
  }

  if (spotifyStatus === "error") {
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
  }>;
}) {
  const [resolvedSearchParams, cookieStore] = await Promise.all([
    searchParams,
    cookies(),
  ]);
  const hasSpotifySession = cookieStore.has(SPOTIFY_SESSION_COOKIE);
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
  const spotifyStatusMessage = getSpotifyStatusMessage(
    resolvedSearchParams,
    hasSpotifySession,
  );
  const initialWorkspace = showConnectedState
    ? await loadSpotifyWorkspaceSnapshot(
        cookieStore.get(SPOTIFY_SESSION_COOKIE)?.value,
      )
    : null;

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <LiquidGradientCanvas
        {...LIQUID_GRADIENT_PRESETS.sunset}
        aria-hidden="true"
        speed={0.35}
        respectReducedMotion
        pauseWhenOffscreen
        pauseWhenHidden
        className="absolute inset-0 h-full w-full"
      />

      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

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
            {HOME_PAGE_COPY.privacy}
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
