import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { getCanonicalOriginRedirectUrl } from "@/lib/auth/canonical-origin";
import { getAuthStatusForOwnerFailure } from "@/lib/auth/notices";
import { resolveAuthenticatedOwner } from "@/lib/auth/owner";
import { buildSignInHref } from "@/lib/auth/redirects";
import { getServerCapabilities } from "@/lib/capabilities/server";
import { getAppUrl } from "@/lib/config";
import {
  COLLECTION_TABS,
  isCollectionTab,
  type CollectionTab,
} from "@/lib/collection/browse";
import { getCrateSource } from "@/lib/listening/sources";
import {
  DEFAULT_SHORTLIST_TAB,
  isShortlistTab,
  SHORTLIST_TABS,
  type ShortlistTab,
} from "@/lib/wantlist/shortlist";
import {
  getSpotifyConnectionState,
  isSpotifyAccountLinked,
} from "@/lib/spotify/connection";
import { getSpotifyConnectionNotice } from "@/lib/spotify/connection-notice";
import { loadWorkspaceSummary } from "@/lib/workspace/summary";
import {
  WORKSPACE_VIEW_DEFINITIONS,
  type WorkspaceViewId,
} from "@/lib/workspace/views";

export const dynamic = "force-dynamic";

function getWorkspaceView(value: string | string[] | undefined): WorkspaceViewId {
  const requestedView = Array.isArray(value) ? value[0] : value;

  // Shelf was merged into Collection. Old links still land on the one page
  // that owns both browsing and group organization.
  if (requestedView === "shelf") {
    return "collection";
  }

  return WORKSPACE_VIEW_DEFINITIONS.some((view) => view.id === requestedView)
    ? (requestedView as WorkspaceViewId)
    : "dashboard";
}

// One `tab` param serves both tabbed surfaces: Collection keeps its status
// filters and the Wantlist keeps its shortlist lenses.
const WORKSPACE_TAB_IDS = new Set<string>([
  ...COLLECTION_TABS.map((tab) => tab.id),
  ...SHORTLIST_TABS.map((tab) => tab.id),
]);

function getWorkspaceTab(
  value: string | string[] | undefined,
): CollectionTab | ShortlistTab | null {
  const requestedTab = Array.isArray(value) ? value[0] : value;

  return typeof requestedTab === "string" &&
    WORKSPACE_TAB_IDS.has(requestedTab)
    ? (requestedTab as CollectionTab | ShortlistTab)
    : null;
}

function getSearchQuery(value: string | string[] | undefined) {
  const query = Array.isArray(value) ? value[0] : value;
  return typeof query === "string" ? query : "";
}

function getSingleParam(value: string | string[] | undefined) {
  const param = Array.isArray(value) ? value[0] : value;
  return typeof param === "string" ? param : null;
}

function getRequestedWorkspacePath(input: {
  view?: string | string[];
  q?: string | string[];
  tab?: string | string[];
  source?: string | string[];
}) {
  const params = new URLSearchParams();
  const requestedView = Array.isArray(input.view) ? input.view[0] : input.view;
  const normalizedView =
    requestedView === "shelf" ? "collection" : requestedView;

  if (
    typeof normalizedView === "string" &&
    WORKSPACE_VIEW_DEFINITIONS.some((view) => view.id === normalizedView)
  ) {
    params.set("view", normalizedView);
  }

  const query = getSearchQuery(input.q);
  if (query) params.set("q", query);

  const tab = getWorkspaceTab(input.tab);
  if (tab && tab !== "all") params.set("tab", tab);

  const requestedSource = Array.isArray(input.source)
    ? input.source[0]
    : input.source;
  // Only echo a source the app actually understands back into the URL.
  if (
    typeof requestedSource === "string" &&
    getCrateSource(requestedSource) === requestedSource
  ) {
    params.set("source", requestedSource);
  }

  const search = params.toString();

  return search ? `/app?${search}` : "/app";
}

export default async function WorkspaceAppPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string | string[];
    q?: string | string[];
    tab?: string | string[];
    source?: string | string[];
    spotify?: string | string[];
    spotifyClaim?: string | string[];
    reason?: string | string[];
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const requestedPath = getRequestedWorkspacePath(resolvedSearchParams);
  const canonicalRedirect =
    await getCanonicalOriginRedirectUrl(requestedPath);

  if (canonicalRedirect) {
    redirect(canonicalRedirect);
  }

  const resolved = await resolveAuthenticatedOwner();

  if (!resolved.ok) {
    redirect(
      getAppUrl(
        buildSignInHref({
          next: requestedPath,
          source: getCrateSource(resolvedSearchParams.source),
          status: getAuthStatusForOwnerFailure(resolved.code),
        }),
      ).toString(),
    );
  }

  const initialWorkspaceSummary = await loadWorkspaceSummary(
    resolved.owner,
  ).catch(() => null);
  const capabilities = getServerCapabilities();
  const requestedTab = getWorkspaceTab(resolvedSearchParams.tab);
  const [spotifyState, spotifyLinked] = await Promise.all([
    getSpotifyConnectionState(resolved.owner.authUserId),
    isSpotifyAccountLinked(resolved.owner.userId),
  ]);

  return (
    <AppShell
      activeView={getWorkspaceView(resolvedSearchParams.view)}
      profile={{
        displayName: resolved.profile.displayName,
        id: resolved.profile.id,
        email: resolved.profile.email,
        imageUrl: resolved.profile.imageUrl,
      }}
      initialWorkspaceSummary={initialWorkspaceSummary}
      initialSearchQuery={getSearchQuery(resolvedSearchParams.q)}
      initialCollectionTab={
        isCollectionTab(requestedTab) ? requestedTab : "all"
      }
      initialWantlistTab={
        isShortlistTab(requestedTab) ? requestedTab : DEFAULT_SHORTLIST_TAB
      }
      initialCrateSource={getCrateSource(resolvedSearchParams.source)}
      spotifyConnection={{
        state: spotifyState,
        linked: spotifyLinked,
        notice: getSpotifyConnectionNotice({
          // The connect flow reports `spotify`; the legacy claim flow reports
          // `spotifyClaim`. Both feed one banner.
          status:
            getSingleParam(resolvedSearchParams.spotify) ??
            getSingleParam(resolvedSearchParams.spotifyClaim),
          reason: getSingleParam(resolvedSearchParams.reason),
        }),
      }}
      publicCapabilities={{
        discogsCollectionSync: capabilities.discogsCollectionSync,
        sellerScout: capabilities.sellerScout,
        spotifyImport: capabilities.spotifyImport,
        spotifyLegacyClaim: capabilities.spotifyLegacyClaim,
        discogsRestrictedData: capabilities.discogsRestrictedData,
        discogsMarketplace: capabilities.discogsMarketplace,
        pressingProof: capabilities.pressingProof,
      }}
    />
  );
}
