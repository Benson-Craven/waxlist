"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  Archive,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Disc3,
  Heart,
  History,
  LayoutDashboard,
  PanelRightClose,
  PanelRightOpen,
  Radar,
  Rows3,
  Search,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Status,
  StatusIndicator,
  StatusLabel,
} from "@/components/ui/status";
import { AddVinylDialog } from "@/components/app-shell/add-vinyl-dialog";
import { CollectionValuePanel } from "@/components/dashboard/collection-value-panel";
import { ShelfSynopsis } from "@/components/dashboard/shelf-synopsis";
import { GlobalWorkspaceSearch } from "@/components/app-shell/global-workspace-search";
import { InspectorSidePanel } from "@/components/app-shell/inspector-side-panel";
import { SignOutForm } from "@/components/app-shell/sign-out-form";
import { usePanelHiddenPreference } from "@/components/app-shell/use-panel-hidden-preference";
import { SelectedRecordInspector } from "@/components/app-shell/selected-record-inspector";
import { CollectionWorkspaceFrame } from "@/components/collection/collection-workspace";
import type { CollectionTab } from "@/lib/collection/browse";
import {
  DEFAULT_SHORTLIST_TAB,
  type ShortlistTab,
} from "@/lib/wantlist/shortlist";
import { COLLECTION_CHANGED_EVENT, type CollectionChangeDetail } from "@/lib/collection/actions";
import { DiggingWorkspaceFrame } from "@/components/digging/digging-workspace";
import { HealthWorkspaceFrame } from "@/components/insights/health-workspace";
import { ListenBrainzCrateWorkspace } from "@/components/listening/listenbrainz-crate-workspace";
import { YouTubeLinkCrateWorkspace } from "@/components/listening/youtube-link-crate-workspace";
import { ConnectedWorkspace } from "@/components/spotify/connected-workspace";
import { SpinLogWorkspaceFrame } from "@/components/spins/spin-log-workspace";
import { WantlistWorkspaceFrame } from "@/components/wantlist/wantlist-workspace";
import { NativeWantlistWorkspace } from "@/components/wantlist/native-wantlist-workspace";
import type { CollectionRecord } from "@/lib/collection/record";
import {
  APP_NAME,
  SPOTIFY_AUTH_LOGOUT_PATH,
  SPOTIFY_AUTH_START_PATH,
} from "@/lib/constants";
import type { SpotifyConnectionNotice } from "@/lib/spotify/connection-notice";
import { cn } from "@/lib/utils";
import {
  CRATE_SOURCES,
  getCrateHref,
  type CrateSource,
} from "@/lib/listening/sources";
import type { SelectedRecord } from "@/lib/workspace/selected-record";
import { SELECTED_RECORD_CHANGED_EVENT } from "@/lib/workspace/selected-record";
import type { WorkspaceSummary } from "@/lib/workspace/summary";
import {
  WORKSPACE_VIEW_DEFINITIONS,
  type WorkspaceViewId,
} from "@/lib/workspace/views";

const WORKSPACE_ICONS = {
  dashboard: LayoutDashboard,
  crate: Disc3,
  collection: Archive,
  spins: History,
  wantlist: Heart,
  digging: Search,
  insights: BarChart3,
  profile: UserRound,
} satisfies Record<WorkspaceViewId, typeof LayoutDashboard>;

const WORKSPACE_VIEWS = WORKSPACE_VIEW_DEFINITIONS.map((view) => ({
  ...view,
  icon: WORKSPACE_ICONS[view.id],
}));

type WorkspaceProfile = {
  displayName: string | null;
  id: string | null;
  email?: string | null;
  imageUrl?: string | null;
};

type AppShellProps = {
  activeView: WorkspaceViewId;
  profile: WorkspaceProfile | null;
  initialWorkspaceSummary?: WorkspaceSummary | null;
  initialSearchQuery?: string;
  initialCollectionTab?: CollectionTab;
  initialWantlistTab?: ShortlistTab;
  initialCrateSource: CrateSource;
  spotifyConnection: {
    state: "connected" | "not_connected";
    linked: boolean;
    notice: SpotifyConnectionNotice | null;
  };
  publicCapabilities: {
    discogsCollectionSync: boolean;
    sellerScout: boolean;
    spotifyImport: boolean;
    spotifyLegacyClaim: boolean;
    discogsRestrictedData: boolean;
    discogsMarketplace: boolean;
    pressingProof: boolean;
  };
};

function getViewHref(viewId: WorkspaceViewId) {
  if (viewId === "dashboard") return "/app";
  if (viewId === "crate") return getCrateHref("spotify");
  return `/app?view=${viewId}`;
}

function getActiveView(viewId: WorkspaceViewId) {
  return (
    WORKSPACE_VIEWS.find((view) => view.id === viewId) ?? WORKSPACE_VIEWS[0]
  );
}

// The stored preference predates the rail, so the key still reads "hidden"
// even though a collapsed sidebar stays visible as an icon rail.
const SIDEBAR_HIDDEN_STORAGE_KEY = "waxlist:app-shell:sidebar-hidden:v1";
const SIDEBAR_HIDDEN_CHANGE_EVENT = "waxlist:app-shell:sidebar-hidden-change";

function PanelToggleButton({
  label,
  controls,
  expanded,
  onClick,
  children,
}: {
  label: string;
  controls: string;
  expanded: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-controls={controls}
      aria-expanded={expanded}
      aria-label={label}
      title={label}
      className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#FFF4E8]/14 bg-[#FFF4E8]/7 text-[#FFF4E8]/72 transition hover:bg-[#FFF4E8]/12 hover:text-[#FFF4E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF4E8]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05030A]"
    >
      {children}
    </button>
  );
}

function SidebarCollapseButton({
  collapsed,
  onClick,
  className,
}: {
  collapsed: boolean;
  onClick: () => void;
  className?: string;
}) {
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-controls="app-sidebar"
      aria-expanded={!collapsed}
      aria-label={label}
      title={label}
      className={cn(
        "place-items-center rounded-full border border-[#FFF4E8]/22 bg-[#0B0613] text-[#FFF4E8]/80 shadow-lg shadow-black/30 transition hover:bg-[#FFF4E8]/12 hover:text-[#FFF4E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF4E8]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05030A]",
        className,
      )}
    >
      {collapsed ? (
        <ChevronRight className="size-3.5" aria-hidden="true" />
      ) : (
        <ChevronLeft className="size-3.5" aria-hidden="true" />
      )}
    </button>
  );
}

function WorkspaceNav({
  activeView,
  collapsed = false,
}: {
  activeView: WorkspaceViewId;
  collapsed?: boolean;
}) {
  const primaryViews = WORKSPACE_VIEWS.filter((view) => view.id !== "profile");
  const navRef = useRef<HTMLElement>(null);

  // Mobile navigation is a horizontal strip. Keep the active workspace in
  // view so a new section does not look missing after navigation.
  useEffect(() => {
    const nav = navRef.current;

    if (!nav || nav.scrollWidth <= nav.clientWidth) {
      return;
    }

    nav
      .querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [activeView]);

  return (
    <nav
      ref={navRef}
      className={cn(
        "flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0",
        collapsed && "lg:items-center lg:gap-1",
      )}
    >
      {primaryViews.map((view) => {
        const Icon = view.icon;
        const isActive = view.id === activeView;

        return (
          <Link
            key={view.id}
            href={getViewHref(view.id)}
            title={view.label}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group flex min-w-max items-center gap-3 rounded-xl border px-3 py-2 text-sm transition lg:min-w-0",
              collapsed &&
                "lg:size-10 lg:shrink-0 lg:justify-center lg:gap-0 lg:px-0 lg:py-0",
              isActive
                ? "border-[#FFF4E8]/24 bg-[#FFF4E8]/12 text-[#FFF4E8] shadow-[0_0_28px_rgba(211,66,120,0.14)]"
                : "border-transparent text-[#FFF4E8]/58 hover:border-[#FFF4E8]/12 hover:bg-[#FFF4E8]/7 hover:text-[#FFF4E8]",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className={cn(collapsed && "lg:sr-only")}>{view.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function WorkspaceConnectionStatus({
  profile,
  summary,
  compact = false,
}: {
  profile: WorkspaceProfile | null;
  summary: WorkspaceSummary | null;
  compact?: boolean;
}) {
  const latestImport = summary?.latestImportRun;
  const status = latestImport?.status === "failed"
    ? "offline"
    : latestImport?.status === "running" || latestImport?.status === "rate_limited"
      ? "maintenance"
      : profile
        ? "online"
        : "maintenance";
  const label = latestImport
    ? latestImport.status === "completed"
      ? "Import current"
      : latestImport.status === "failed"
        ? "Import failed"
        : latestImport.status === "rate_limited"
          ? "Rate limited"
          : "Import running"
    : profile
      ? "Signed in"
      : "Checking account";

  if (compact) {
    return (
      <Status
        status={status}
        className="size-8 justify-center border-white/10 bg-white/8 p-0"
        role="status"
        aria-label={`Workspace status: ${label}`}
        title={label}
      >
        <StatusIndicator />
        <span className="sr-only">{label}</span>
      </Status>
    );
  }

  return (
    <Status
      status={status}
      className="h-8 border-white/10 bg-white/8 px-3 text-xs text-[#FFF4E8] backdrop-blur"
      role="status"
      aria-label={`Workspace status: ${label}`}
    >
      <StatusIndicator />
      <StatusLabel className="text-[#FFF4E8]/72">
        {label}
      </StatusLabel>
    </Status>
  );
}

function ProfileNavLink({
  activeView,
  collapsed = false,
}: {
  activeView: WorkspaceViewId;
  collapsed?: boolean;
}) {
  const isActive = activeView === "profile";

  return (
    <Link
      href="/app?view=profile"
      title="Profile"
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition",
        collapsed && "lg:size-10 lg:justify-center lg:gap-0 lg:px-0 lg:py-0",
        isActive
          ? "border-[#FFF4E8]/24 bg-[#FFF4E8]/12 text-[#FFF4E8]"
          : "border-transparent text-[#FFF4E8]/58 hover:border-[#FFF4E8]/12 hover:bg-[#FFF4E8]/7 hover:text-[#FFF4E8]",
      )}
    >
      <UserRound className="size-4 shrink-0" aria-hidden="true" />
      <span className={cn(collapsed && "lg:sr-only")}>Profile</span>
    </Link>
  );
}

function DashboardHome({
  summary,
  canRefreshPrices,
}: {
  summary: WorkspaceSummary | null;
  canRefreshPrices: boolean;
}) {
  const synopsis = summary?.synopsis ?? null;
  const dashboardMetrics = [
    {
      id: "collection",
      label: "Collection",
      value: summary?.collectionCount ?? 0,
      href: "/app?view=collection",
    },
    {
      id: "owned",
      label: "Owned",
      value: summary?.ownedCount ?? 0,
      href: "/app?view=collection",
    },
    {
      id: "wanted",
      label: "Wanted",
      value: summary?.wantedCount ?? 0,
      href: "/app?view=wantlist&tab=wanted",
    },
    {
      id: "favourites",
      label: "Favourites",
      value: summary?.favouriteCount ?? 0,
      href: "/app?view=wantlist&tab=favourites",
    },
    {
      id: "spins",
      label: "Spins this week",
      value: summary?.spinCount7d ?? 0,
      href: "/app?view=spins",
    },
  ];
  const actionRows = [
    {
      id: "spins",
      label: "Log a spin",
      meta:
        summary && summary.spinTotal > 0
          ? `${summary.spinTotal.toLocaleString()} logged`
          : null,
      href: "/app?view=spins",
      icon: History,
    },
    {
      id: "shelf",
      label: "Group your vinyls",
      meta:
        summary && summary.missingLocationCount > 0
          ? `${summary.missingLocationCount.toLocaleString()} unsorted`
          : null,
      href: "/app?view=collection#shelving",
      icon: Rows3,
    },
    {
      id: "digging",
      label: "Open Digging mode",
      meta: null,
      href: "/app?view=digging",
      icon: Radar,
    },
  ];
  return (
    <section
      className="wax-dashboard-surface relative w-full overflow-hidden rounded-[26px]"
      aria-label="Dashboard overview"
    >
      {synopsis ? (
        <div className="relative z-10 px-4 pt-8 sm:px-6 sm:pt-10 lg:px-7 lg:pt-12">
          <ShelfSynopsis synopsis={synopsis} />
        </div>
      ) : (
        <div className="relative z-10 px-4 pt-8 sm:px-6 sm:pt-10 lg:px-7 lg:pt-12">
          <div className="flex flex-col items-center justify-center px-2 py-10 text-center sm:py-12">
            <Disc3
              className="mx-auto size-9 text-[#FFF4E8]/38"
              aria-hidden="true"
            />
            <h2 className="mt-4 font-serif text-2xl italic leading-tight text-[#FFF4E8] sm:text-3xl">
              Nothing on the shelf yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#FFF4E8]/56">
              Add a record or import your collection. The synopsis fills in as
              your shelf grows.
            </p>
            <Button
              asChild
              className="mt-5 rounded-full bg-[#FFF4E8] text-[#08030f] hover:bg-[#f6dfc9]"
            >
              <Link href="/app?view=collection">Open collection</Link>
            </Button>
          </div>
        </div>
      )}

      <div className="relative z-10 px-4 pb-10 pt-8 sm:px-6 lg:px-7">
        <section aria-labelledby="dashboard-metrics-heading">
          <h2 id="dashboard-metrics-heading" className="sr-only">
            Collection at a glance
          </h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3 lg:grid-cols-5">
            {dashboardMetrics.map((metric) => (
              <Link
                key={metric.id}
                href={metric.href}
                className="group block py-1"
              >
                <span
                  className="block h-px w-6 bg-[#FFF4E8]/16 transition group-hover:bg-[#FFF4E8]/40"
                  aria-hidden="true"
                />
                <span className="mt-3 block text-[0.65rem] uppercase tracking-[0.18em] text-[#FFF4E8]/45">
                  {metric.label}
                </span>
                <span className="mt-2 block text-3xl font-semibold tabular-nums text-[#FFF4E8] transition group-hover:text-[#f6dfc9]">
                  {metric.value.toLocaleString()}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <CollectionValuePanel
          pricing={summary?.pricing ?? null}
          canRefreshPrices={canRefreshPrices}
          recordCount={summary?.collectionCount ?? 0}
        />

        <section
          className="mt-12 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
          aria-labelledby="listening-discovery-heading"
        >
          <div>
            <h2
              id="listening-discovery-heading"
              className="text-2xl font-semibold text-[#FFF4E8]"
            >
              Find your next gap
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#FFF4E8]/52">
              A record only counts as missing once Discogs confirms the release.
            </p>
          </div>
          <Button
            asChild
            className="w-fit rounded-full bg-[#FFF4E8] px-5 text-[#08030f] hover:bg-[#f6dfc9]"
          >
            <Link href={getCrateHref("spotify")}>
              <Disc3 className="size-4" aria-hidden="true" />
              Build crate
            </Link>
          </Button>
        </section>

        <section className="mt-12" aria-labelledby="dashboard-actions-heading">
          <h2 id="dashboard-actions-heading" className="sr-only">
            Quick actions
          </h2>
          <div className="grid gap-1 sm:grid-cols-2">
            {actionRows.map((action) => {
              const Icon = action.icon;

              return (
                <Link
                  key={action.id}
                  href={action.href}
                  className="group flex items-center justify-between gap-4 rounded-xl px-3 py-4 text-left transition hover:bg-[#FFF4E8]/[0.06]"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#FFF4E8]/[0.07] text-[#FFF4E8] transition group-hover:bg-[#FFF4E8]/12">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[#FFF4E8]">
                        {action.label}
                      </span>
                      {action.meta ? (
                        <span className="mt-0.5 block text-xs text-[#FFF4E8]/42">
                          {action.meta}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <ArrowRight
                    className="size-4 shrink-0 text-[#FFF4E8]/36 transition group-hover:translate-x-0.5 group-hover:text-[#FFF4E8]/70"
                    aria-hidden="true"
                  />
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
}

const CRATE_SOURCE_LABELS: Record<CrateSource, string> = {
  spotify: "Spotify",
  listenbrainz: "ListenBrainz",
  youtube: "YouTube",
};

function CrateWorkspace({
  source,
  allowSpotifyImport,
  spotifyConnection,
}: {
  source: CrateSource;
  allowSpotifyImport: boolean;
  spotifyConnection: {
    state: "connected" | "not_connected";
    notice: SpotifyConnectionNotice | null;
  };
}) {
  return (
    <section className="min-w-0 space-y-5 py-1" aria-label="Crate workspace">
      <nav
        aria-label="Crate source"
        className="flex max-w-full gap-2 overflow-x-auto rounded-2xl border border-[#FFF4E8]/10 bg-[#08030f]/48 p-2"
      >
        {CRATE_SOURCES.map((candidateSource) => (
          <Link
            key={candidateSource}
            href={getCrateHref(candidateSource)}
            aria-current={source === candidateSource ? "page" : undefined}
            className={cn(
              "min-w-max rounded-full px-4 py-2 text-sm font-medium transition",
              source === candidateSource
                ? "bg-[#FFF4E8] text-[#08030f]"
                : "text-[#FFF4E8]/58 hover:bg-[#FFF4E8]/8 hover:text-[#FFF4E8]",
            )}
          >
            {CRATE_SOURCE_LABELS[candidateSource]}
          </Link>
        ))}
      </nav>

      {source === "spotify" ? (
        allowSpotifyImport ? (
          <ConnectedWorkspace
            showProfilePanel={false}
            connectionState={spotifyConnection.state}
            connectionNotice={spotifyConnection.notice}
          />
        ) : (
          <div className="rounded-2xl border border-[#FFF4E8]/10 bg-[#08030f]/48 p-6">
            <p className="text-sm text-[#FFF4E8]/64">
              Spotify import is off for this account.
            </p>
          </div>
        )
      ) : source === "listenbrainz" ? (
        <ListenBrainzCrateWorkspace />
      ) : (
        <YouTubeLinkCrateWorkspace />
      )}
    </section>
  );
}

function ProfileWorkspace({
  profile,
  allowSpotifyLegacyClaim,
  spotifyLinked,
  ratedCount,
}: {
  profile: WorkspaceProfile | null;
  allowSpotifyLegacyClaim: boolean;
  spotifyLinked: boolean;
  ratedCount: number;
}) {
  const profileName = profile?.displayName ?? profile?.id ?? "Collector";

  return (
    <section className="min-w-0 space-y-6 py-1" aria-label="Profile">
      <div className="max-w-3xl rounded-2xl border border-[#FFF4E8]/10 bg-[#08030f]/48 p-5">
        <div className="flex items-center gap-4">
          {profile?.imageUrl ? (
            <div
              className="size-16 shrink-0 rounded-2xl bg-cover bg-center"
              style={{ backgroundImage: `url(${profile.imageUrl})` }}
              aria-label={`${profileName} profile image`}
              role="img"
            />
          ) : (
            <span className="grid size-16 shrink-0 place-items-center rounded-2xl border border-[#1DB954]/24 bg-[#1DB954]/12 text-[#1DB954]">
              <UserRound className="size-7" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.24em] text-[#FFF4E8]/42">
              WAXLIST account
            </p>
            <h2 className="mt-2 truncate text-2xl font-semibold text-[#FFF4E8]">
              {profileName}
            </h2>
            <p className="mt-1 truncate text-sm text-[#FFF4E8]/52">
              {profile?.email ?? "Email unavailable"}
            </p>
          </div>
        </div>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[#FFF4E8]/8 bg-[#FFF4E8]/5 p-4">
            <dt className="text-xs text-[#FFF4E8]/45">Account ID</dt>
            <dd className="mt-2 truncate text-sm font-medium text-[#FFF4E8]">
              {profile?.id ?? "Unavailable"}
            </dd>
          </div>
          <div className="rounded-xl border border-[#FFF4E8]/8 bg-[#FFF4E8]/5 p-4">
            <dt className="text-xs text-[#FFF4E8]/45">Rated records</dt>
            <dd className="mt-2 text-sm font-medium text-[#FFF4E8]">
              {ratedCount.toLocaleString()} rated
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {allowSpotifyLegacyClaim ? (
            <Button
              asChild
              variant="outline"
              className="rounded-full border-[#FFF4E8]/14 bg-[#FFF4E8]/8 text-[#FFF4E8] hover:bg-[#FFF4E8]/14"
            >
              <Link href="/api/auth/spotify/login">
                Claim legacy Spotify data
              </Link>
            </Button>
          ) : null}
          {spotifyLinked ? (
            <form action={SPOTIFY_AUTH_LOGOUT_PATH} method="post">
              <Button
                type="submit"
                variant="outline"
                className="w-full rounded-full border-[#FFF4E8]/14 bg-transparent text-[#FFF4E8]/72 hover:bg-[#FFF4E8]/10 hover:text-[#FFF4E8] sm:w-auto"
              >
                Disconnect Spotify
              </Button>
            </form>
          ) : null}
          <SignOutForm buttonClassName="w-full rounded-full border-[#FFF4E8]/14 bg-transparent text-[#FFF4E8]/72 hover:bg-[#FFF4E8]/10 hover:text-[#FFF4E8] sm:w-auto" />
        </div>
      </div>
    </section>
  );
}

function SpotifyConnectionNoticeBanner({
  notice,
}: {
  notice: SpotifyConnectionNotice;
}) {
  const isSuccess = notice.tone === "success";
  const Icon = isSuccess ? CheckCircle2 : AlertTriangle;

  return (
    <div
      role={isSuccess ? "status" : "alert"}
      aria-live={isSuccess ? "polite" : "assertive"}
      data-tone={notice.tone}
      className={cn(
        "rounded-2xl border p-4",
        isSuccess
          ? "border-[#1DB954]/28 bg-[#1DB954]/10"
          : "border-[#F08A4B]/28 bg-[#F08A4B]/8",
      )}
    >
      <div className="flex items-start gap-3">
        <Icon
          className={cn(
            "mt-0.5 size-4 shrink-0",
            isSuccess ? "text-[#1DB954]" : "text-[#F08A4B]",
          )}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#FFF4E8]">{notice.title}</p>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#FFF4E8]/62">
            {notice.message}
          </p>
          {notice.action ? (
            <Button
              asChild
              size="sm"
              className="mt-3 rounded-full bg-[#FFF4E8] text-[#08030f] hover:bg-[#f6dfc9]"
            >
              {/* A plain anchor keeps Next from prefetching an OAuth entry
                  point, which would burn the signed state cookie. */}
              <a href={SPOTIFY_AUTH_START_PATH}>
                {notice.action === "connect"
                  ? "Connect Spotify"
                  : "Try Spotify again"}
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function AppShell({
  activeView,
  profile,
  initialWorkspaceSummary = null,
  initialSearchQuery = "",
  initialCollectionTab = "all",
  initialWantlistTab = DEFAULT_SHORTLIST_TAB,
  initialCrateSource,
  spotifyConnection,
  publicCapabilities,
}: AppShellProps) {
  const activeWorkspaceView = getActiveView(activeView);
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = usePanelHiddenPreference(
    SIDEBAR_HIDDEN_STORAGE_KEY,
    SIDEBAR_HIDDEN_CHANGE_EVENT,
  );
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<SelectedRecord | null>(
    null,
  );
  // Adding or deleting changes server-derived counts and row lists. Bumping a
  // revision remounts the active workspace so every view reads fresh data.
  const [collectionRevision, setCollectionRevision] = useState(0);
  // One query drives the shell search and the Collection view. Typing filters
  // the collection as you go; submitting jumps to a searchable view elsewhere.
  // The view/URL pair is the reset key, so navigating resets the field without
  // an effect.
  const searchResetKey = `${activeView}:${initialSearchQuery}`;
  const [workspaceSearch, setWorkspaceSearch] = useState({
    resetKey: searchResetKey,
    query: initialSearchQuery,
  });

  if (workspaceSearch.resetKey !== searchResetKey) {
    setWorkspaceSearch({ resetKey: searchResetKey, query: initialSearchQuery });
  }

  const workspaceSearchQuery = workspaceSearch.query;

  function setWorkspaceSearchQuery(query: string) {
    setWorkspaceSearch({ resetKey: searchResetKey, query });
  }

  function handleWorkspaceSearchSubmit(query: string) {
    if (activeView === "collection") {
      // Collection already filters on every keystroke, so submitting has
      // nothing left to navigate to.
      return;
    }

    const targetView = activeView === "digging" ? "digging" : "collection";
    const params = new URLSearchParams({ view: targetView });

    if (query) {
      params.set("q", query);
    }

    router.push(`/app?${params.toString()}`);
  }

  function handleSidebarToggle() {
    setSidebarCollapsed(!sidebarCollapsed);
  }

  const closeInspector = useCallback(() => {
    setInspectorOpen(false);
  }, []);

  // Selecting a record is the primary way into the panel, so user selections
  // slide it out automatically. A view that pre-selects during load can opt
  // out with `reveal: false`.
  const handleSelectRecord = useCallback(
    (record: SelectedRecord | null, options?: { reveal?: boolean }) => {
      setSelectedRecord(record);

      if (record && options?.reveal !== false) {
        setInspectorOpen(true);
      }
    },
    [],
  );

  useEffect(() => {
    function handleSelectedRecordChange(event: Event) {
      const detail = (event as CustomEvent<SelectedRecord | null>).detail;
      setSelectedRecord(detail);
    }

    function handleCollectionChange(event: Event) {
      const detail = (event as CustomEvent<CollectionChangeDetail>).detail;

      if (detail.reason !== "added" && detail.reason !== "deleted") {
        return;
      }

      setSelectedRecord((current) =>
        detail.reason === "deleted" &&
        current?.collectionId &&
        current.collectionId === detail.collectionId
          ? null
          : current,
      );
      setCollectionRevision((revision) => revision + 1);
      router.refresh();
    }

    window.addEventListener(
      SELECTED_RECORD_CHANGED_EVENT,
      handleSelectedRecordChange,
    );
    window.addEventListener(COLLECTION_CHANGED_EVENT, handleCollectionChange);

    return () => {
      window.removeEventListener(
        SELECTED_RECORD_CHANGED_EVENT,
        handleSelectedRecordChange,
      );
      window.removeEventListener(
        COLLECTION_CHANGED_EVENT,
        handleCollectionChange,
      );
    };
  }, [router]);

  async function handleRateRecord(
    record: CollectionRecord,
    rating: number | null,
  ) {
    const response = await fetch(`/api/collection/${record.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ rating }),
    });
    const payload = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;

    if (!response.ok) {
      throw new Error(payload?.error?.message ?? "Rating could not be saved.");
    }

    router.refresh();
  }
  const activeViewKey = `${activeView}:${initialSearchQuery}:${initialCollectionTab}:${initialWantlistTab}:${collectionRevision}`;

  return (
    <main className="wax-flat min-h-screen bg-[#05030A] text-[#FFF4E8]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_52%_10%,rgba(211,66,120,0.13),transparent_26%),radial-gradient(circle_at_82%_18%,rgba(240,138,75,0.08),transparent_22%),linear-gradient(180deg,rgba(12,10,15,0.94),rgba(5,3,10,0.98))]" />
      <div
        className={cn(
          "relative mx-auto flex min-h-screen w-full flex-col gap-6 px-4 py-4 sm:px-6 lg:grid lg:px-8 lg:py-6",
          sidebarCollapsed
            ? "lg:grid-cols-[4.75rem_minmax(0,1fr)]"
            : "lg:grid-cols-[12.5rem_minmax(0,1fr)]",
        )}
      >
        <aside
          id="app-sidebar"
          aria-label="Workspace navigation"
          className={cn(
            "relative rounded-2xl border border-[#FFF4E8]/8 bg-[#08030f]/48 p-4 shadow-2xl shadow-black/20 lg:sticky lg:top-6 lg:h-[calc(100vh-4.5rem)]",
            sidebarCollapsed ? "lg:p-2.5" : "lg:p-4",
          )}
        >
          <SidebarCollapseButton
            collapsed={sidebarCollapsed}
            onClick={handleSidebarToggle}
            className="absolute top-1/2 -right-3 z-10 hidden size-6 -translate-y-1/2 lg:grid"
          />

          <div
            className={cn(
              "flex items-center justify-between gap-3",
              sidebarCollapsed && "lg:justify-center",
            )}
          >
            <Link href="/" className="inline-flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full border border-[#FFF4E8]/16 bg-[#FFF4E8]/8 font-serif text-lg italic">
                W
              </span>
              <span className={cn(sidebarCollapsed && "lg:sr-only")}>
                <span className="block font-serif text-xl italic leading-none">
                  {APP_NAME}
                </span>
              </span>
            </Link>
            <SignOutForm
              size="sm"
              buttonClassName="rounded-full border-[#FFF4E8]/14 bg-transparent text-[#FFF4E8]/72 hover:bg-[#FFF4E8]/10 hover:text-[#FFF4E8] lg:hidden"
            />
          </div>

          <div className={cn("mt-5", sidebarCollapsed && "lg:mt-4")}>
            <div className={cn(sidebarCollapsed && "lg:hidden")}>
              <WorkspaceConnectionStatus
                profile={profile}
                summary={initialWorkspaceSummary}
              />
            </div>
            {sidebarCollapsed ? (
              <div className="hidden lg:flex lg:justify-center">
                <WorkspaceConnectionStatus
                  profile={profile}
                  summary={initialWorkspaceSummary}
                  compact
                />
              </div>
            ) : null}
          </div>

          <div className={cn("mt-5", !sidebarCollapsed && "lg:mt-8")}>
            <WorkspaceNav activeView={activeView} collapsed={sidebarCollapsed} />
          </div>

          <div className={cn("mt-5", sidebarCollapsed && "lg:mt-4")}>
            <ProfileNavLink activeView={activeView} collapsed={sidebarCollapsed} />
            <SignOutForm
              className={cn(
                "mt-4 hidden lg:block",
                sidebarCollapsed && "lg:flex lg:justify-center",
              )}
              buttonClassName={cn(
                "w-full rounded-full border-[#FFF4E8]/14 bg-transparent text-[#FFF4E8]/72 hover:bg-[#FFF4E8]/10 hover:text-[#FFF4E8]",
                sidebarCollapsed && "px-0",
              )}
              iconOnly={sidebarCollapsed}
            />
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-6 pb-6">
          <header className="rounded-2xl border border-[#FFF4E8]/8 bg-[#08030f]/46 p-5 shadow-2xl shadow-black/20 sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <h1 className="min-w-0 truncate text-2xl font-semibold text-[#FFF4E8]">
                  {activeWorkspaceView.label}
                </h1>
                <div className="flex shrink-0 items-center gap-2">
                  <PanelToggleButton
                    label={
                      inspectorOpen ? "Hide inspector" : "Open inspector"
                    }
                    controls="record-inspector-panel"
                    expanded={inspectorOpen}
                    onClick={() => setInspectorOpen(!inspectorOpen)}
                  >
                    {inspectorOpen ? (
                      <PanelRightClose className="size-4" aria-hidden="true" />
                    ) : (
                      <PanelRightOpen className="size-4" aria-hidden="true" />
                    )}
                  </PanelToggleButton>
                </div>
              </div>
              {activeView === "crate" || activeView === "digging" ? (
                <AddVinylDialog />
              ) : (
                <div className="flex min-w-0 items-center gap-2 xl:max-w-2xl xl:flex-1 xl:justify-end">
                  <div className="min-w-0 flex-1">
                    <GlobalWorkspaceSearch
                      query={workspaceSearchQuery}
                      onQueryChange={setWorkspaceSearchQuery}
                      onSubmit={handleWorkspaceSearchSubmit}
                    />
                  </div>
                  <AddVinylDialog />
                </div>
              )}
            </div>
          </header>

          {spotifyConnection.notice ? (
            <SpotifyConnectionNoticeBanner notice={spotifyConnection.notice} />
          ) : null}

          <div className="min-w-0">
            {activeView === "dashboard" ? (
              <DashboardHome
                summary={initialWorkspaceSummary}
                canRefreshPrices={publicCapabilities.discogsMarketplace}
              />
            ) : activeView === "spins" ? (
              <SpinLogWorkspaceFrame onSelectRecord={handleSelectRecord} />
            ) : activeView === "collection" ? (
              <CollectionWorkspaceFrame
                key={activeViewKey}
                initialTab={initialCollectionTab}
                query={workspaceSearchQuery}
                onQueryChange={setWorkspaceSearchQuery}
                selectedRecord={selectedRecord}
                onSelectRecord={handleSelectRecord}
                onRateRecord={handleRateRecord}
                allowDiscogsImport={publicCapabilities.discogsCollectionSync}
                showRestrictedData={publicCapabilities.discogsRestrictedData}
              />
            ) : activeView === "wantlist" ? (
              publicCapabilities.sellerScout ? (
                <WantlistWorkspaceFrame
                  key={activeViewKey}
                  initialQuery={initialSearchQuery}
                  selectedRecord={selectedRecord}
                  onSelectRecord={handleSelectRecord}
                />
              ) : (
                <NativeWantlistWorkspace
                  initialTab={initialWantlistTab}
                  onSelectRecord={handleSelectRecord}
                />
              )
            ) : activeView === "digging" ? (
              <DiggingWorkspaceFrame
                key={activeViewKey}
                initialQuery={initialSearchQuery}
                selectedRecord={selectedRecord}
                onSelectRecord={handleSelectRecord}
                showRestrictedData={publicCapabilities.discogsRestrictedData}
                allowPressingProof={publicCapabilities.pressingProof}
              />
            ) : activeView === "insights" ? (
              <HealthWorkspaceFrame
                selectedRecord={selectedRecord}
                onSelectRecord={handleSelectRecord}
                showRestrictedData={publicCapabilities.discogsRestrictedData}
              />
            ) : activeView === "crate" ? (
              <CrateWorkspace
                source={initialCrateSource}
                allowSpotifyImport={publicCapabilities.spotifyImport}
                spotifyConnection={spotifyConnection}
              />
            ) : activeView === "profile" ? (
              <ProfileWorkspace
                profile={profile}
                allowSpotifyLegacyClaim={
                  publicCapabilities.spotifyLegacyClaim
                }
                spotifyLinked={spotifyConnection.linked}
                ratedCount={initialWorkspaceSummary?.ratedCount ?? 0}
              />
            ) : null}
          </div>

          <InspectorSidePanel
            id="record-inspector-panel"
            open={inspectorOpen}
            labelledBy="record-inspector-heading"
            onClose={closeInspector}
          >
            <SelectedRecordInspector
              record={selectedRecord}
              onRecordChange={setSelectedRecord}
              showRestrictedData={publicCapabilities.discogsRestrictedData}
              canFetchDiscogsPrice={publicCapabilities.discogsMarketplace}
            />
          </InspectorSidePanel>
        </div>
      </div>
    </main>
  );
}
