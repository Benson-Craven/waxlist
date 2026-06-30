import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  AppShell,
  WORKSPACE_VIEWS,
  type WorkspaceViewId,
} from "@/components/app-shell/app-shell";
import {
  SPOTIFY_AUTH_REFRESH_PATH,
  SPOTIFY_SESSION_COOKIE,
} from "@/lib/constants";
import { getSessionSecretEnv } from "@/lib/config";
import {
  decodeSpotifySession,
  shouldRefreshSpotifySession,
} from "@/lib/spotify/oauth";
import { loadSpotifyWorkspaceSnapshot } from "@/lib/spotify/workspace";

function getWorkspaceView(value: string | string[] | undefined): WorkspaceViewId {
  const requestedView = Array.isArray(value) ? value[0] : value;

  return WORKSPACE_VIEWS.some((view) => view.id === requestedView)
    ? (requestedView as WorkspaceViewId)
    : "dashboard";
}

export default async function WorkspaceAppPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string | string[];
  }>;
}) {
  const [cookieStore, resolvedSearchParams] = await Promise.all([
    cookies(),
    searchParams,
  ]);
  const sessionCookieValue = cookieStore.get(SPOTIFY_SESSION_COOKIE)?.value;

  if (!sessionCookieValue) {
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

  return (
    <AppShell
      activeView={getWorkspaceView(resolvedSearchParams.view)}
      profile={profile}
      initialSpotifyWorkspace={initialWorkspace}
    />
  );
}
