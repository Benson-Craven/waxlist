import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { resolveCollectionOwnerFromSpotifyProfile } from "@/lib/collection/server";
import {
  SPOTIFY_AUTH_REFRESH_PATH,
  SPOTIFY_SESSION_COOKIE,
} from "@/lib/constants";
import { appConfig, getDatabaseEnv, getSessionSecretEnv } from "@/lib/config";
import {
  decodeSpotifySession,
  shouldRefreshSpotifySession,
} from "@/lib/spotify/oauth";
import { loadSpotifyWorkspaceSnapshot } from "@/lib/spotify/workspace";
import { loadWorkspaceSummary } from "@/lib/workspace/summary";
import {
  WORKSPACE_VIEW_DEFINITIONS,
  type WorkspaceViewId,
} from "@/lib/workspace/views";

function getWorkspaceView(value: string | string[] | undefined): WorkspaceViewId {
  const requestedView = Array.isArray(value) ? value[0] : value;

  return WORKSPACE_VIEW_DEFINITIONS.some((view) => view.id === requestedView)
    ? (requestedView as WorkspaceViewId)
    : "dashboard";
}

function getSearchQuery(value: string | string[] | undefined) {
  const query = Array.isArray(value) ? value[0] : value;

  return typeof query === "string" ? query : "";
}

function getSpotifyRedirectOrigin() {
  try {
    return new URL(appConfig.spotifyRedirectUri).origin;
  } catch {
    return null;
  }
}

function getCanonicalWorkspaceUrl(input: {
  origin: string;
  view?: string | string[];
  query?: string | string[];
}) {
  const url = new URL("/app", input.origin);
  const view = Array.isArray(input.view) ? input.view[0] : input.view;
  const query = Array.isArray(input.query) ? input.query[0] : input.query;

  if (view) {
    url.searchParams.set("view", view);
  }

  if (query) {
    url.searchParams.set("q", query);
  }

  return url.toString();
}

export default async function WorkspaceAppPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string | string[];
    q?: string | string[];
  }>;
}) {
  const [cookieStore, resolvedSearchParams] = await Promise.all([
    cookies(),
    searchParams,
  ]);
  const sessionCookieValue = cookieStore.get(SPOTIFY_SESSION_COOKIE)?.value;

  if (!sessionCookieValue) {
    const requestHeaders = await headers();
    const requestHost = requestHeaders.get("host");
    const spotifyRedirectOrigin = getSpotifyRedirectOrigin();

    if (requestHost && spotifyRedirectOrigin) {
      const spotifyRedirectHost = new URL(spotifyRedirectOrigin).host;

      if (requestHost !== spotifyRedirectHost) {
        redirect(
          getCanonicalWorkspaceUrl({
            origin: spotifyRedirectOrigin,
            view: resolvedSearchParams.view,
            query: resolvedSearchParams.q,
          }),
        );
      }
    }

    redirect("/?spotify=error&reason=session_missing");
  }

  const sessionSecret = getSessionSecretEnv();

  if (!sessionSecret.ok) {
    redirect("/?spotify=error&reason=session_configuration_error");
  }

  const spotifySession = decodeSpotifySession(
    sessionCookieValue,
    sessionSecret.secret,
  );

  if (!spotifySession) {
    redirect("/?spotify=error&reason=session_expired");
  }

  if (shouldRefreshSpotifySession(spotifySession)) {
    redirect(SPOTIFY_AUTH_REFRESH_PATH);
  }

  const initialWorkspace = await loadSpotifyWorkspaceSnapshot(sessionCookieValue);
  const profile = initialWorkspace
    ? {
        displayName: initialWorkspace.profile.displayName,
        id: initialWorkspace.profile.id,
        country: initialWorkspace.profile.country,
        product: initialWorkspace.profile.product,
        externalUrl: initialWorkspace.profile.externalUrl,
        imageUrl: initialWorkspace.profile.imageUrl,
      }
    : null;
  const initialWorkspaceSummary =
    profile?.id && getDatabaseEnv().ok
      ? await resolveCollectionOwnerFromSpotifyProfile({
          spotifyUserId: profile.id,
          displayName: profile.displayName,
          imageUrl: profile.imageUrl,
        })
          .then((owner) => (owner ? loadWorkspaceSummary(owner) : null))
          .catch(() => null)
      : null;

  return (
    <AppShell
      activeView={getWorkspaceView(resolvedSearchParams.view)}
      profile={profile}
      initialSpotifyWorkspace={initialWorkspace}
      initialWorkspaceSummary={initialWorkspaceSummary}
      initialSearchQuery={getSearchQuery(resolvedSearchParams.q)}
    />
  );
}
