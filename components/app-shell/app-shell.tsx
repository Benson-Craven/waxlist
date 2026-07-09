"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Archive,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Disc3,
  Heart,
  LayoutDashboard,
  Map,
  Radar,
  RefreshCw,
  Search,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Status,
  StatusIndicator,
  StatusLabel,
} from "@/components/ui/status";
import { GlobalWorkspaceSearch } from "@/components/app-shell/global-workspace-search";
import { SelectedRecordInspector } from "@/components/app-shell/selected-record-inspector";
import { CollectionWorkspaceFrame } from "@/components/collection/collection-workspace";
import { DiggingWorkspaceFrame } from "@/components/digging/digging-workspace";
import { HealthWorkspaceFrame } from "@/components/insights/health-workspace";
import { ShelfWorkspaceFrame } from "@/components/shelf/shelf-workspace";
import { ConnectedWorkspace } from "@/components/spotify/connected-workspace";
import { WantlistWorkspaceFrame } from "@/components/wantlist/wantlist-workspace";
import { APP_NAME, SPOTIFY_AUTH_LOGOUT_PATH } from "@/lib/constants";
import type { SpotifyWorkspaceSnapshot } from "@/lib/spotify/workspace";
import { cn } from "@/lib/utils";
import type { SelectedRecord } from "@/lib/workspace/selected-record";
import type { WorkspaceSummary } from "@/lib/workspace/summary";
import {
  WORKSPACE_VIEW_DEFINITIONS,
  type WorkspaceViewId,
} from "@/lib/workspace/views";

const WORKSPACE_ICONS = {
  dashboard: LayoutDashboard,
  crate: Disc3,
  collection: Archive,
  wantlist: Heart,
  digging: Search,
  shelf: Map,
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
  country?: string | null;
  product?: string | null;
  externalUrl?: string | null;
  imageUrl?: string | null;
};

type AppShellProps = {
  activeView: WorkspaceViewId;
  profile: WorkspaceProfile | null;
  initialSpotifyWorkspace?: SpotifyWorkspaceSnapshot | null;
  initialWorkspaceSummary?: WorkspaceSummary | null;
  initialSearchQuery?: string;
};

function getViewHref(viewId: WorkspaceViewId) {
  return viewId === "dashboard" ? "/app" : `/app?view=${viewId}`;
}

function getActiveView(viewId: WorkspaceViewId) {
  return (
    WORKSPACE_VIEWS.find((view) => view.id === viewId) ?? WORKSPACE_VIEWS[0]
  );
}

function WorkspaceNav({ activeView }: { activeView: WorkspaceViewId }) {
  const primaryViews = WORKSPACE_VIEWS.filter((view) => view.id !== "profile");

  return (
    <nav className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
      {primaryViews.map((view) => {
        const Icon = view.icon;
        const isActive = view.id === activeView;

        return (
          <Link
            key={view.id}
            href={getViewHref(view.id)}
            className={cn(
              "group flex min-w-max items-center gap-3 rounded-xl border px-3 py-2 text-sm transition lg:min-w-0",
              isActive
                ? "border-[#FFF4E8]/24 bg-[#FFF4E8]/12 text-[#FFF4E8] shadow-[0_0_28px_rgba(211,66,120,0.14)]"
                : "border-transparent text-[#FFF4E8]/58 hover:border-[#FFF4E8]/12 hover:bg-[#FFF4E8]/7 hover:text-[#FFF4E8]",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span>{view.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function WorkspaceConnectionStatus({
  profile,
  summary,
}: {
  profile: WorkspaceProfile | null;
  summary: WorkspaceSummary | null;
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
      ? "No import yet"
      : "Syncing Spotify";

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

function ProfileNavLink({ activeView }: { activeView: WorkspaceViewId }) {
  const isActive = activeView === "profile";

  return (
    <Link
      href="/app?view=profile"
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition",
        isActive
          ? "border-[#FFF4E8]/24 bg-[#FFF4E8]/12 text-[#FFF4E8]"
          : "border-transparent text-[#FFF4E8]/58 hover:border-[#FFF4E8]/12 hover:bg-[#FFF4E8]/7 hover:text-[#FFF4E8]",
      )}
    >
      <UserRound className="size-4 shrink-0" aria-hidden="true" />
      <span>Profile</span>
    </Link>
  );
}

function formatRelativeImportTime(value: string | null | undefined) {
  if (!value) {
    return "Not imported yet";
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return "Import time unavailable";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function getImportStatusCopy(summary: WorkspaceSummary | null) {
  const run = summary?.latestImportRun;

  if (!run) {
    return {
      title: "Not imported yet",
      body: "Connect Discogs import from Collection to populate owned records and shelf status.",
      icon: Clock3,
      tone: "border-[#FFF4E8]/12 bg-[#FFF4E8]/6 text-[#FFF4E8]/62",
    };
  }

  if (run.status === "failed") {
    return {
      title: "Import failed",
      body: `${run.importedCount.toLocaleString()} records imported before the last error. Resume from Collection.`,
      icon: AlertTriangle,
      tone: "border-[#D34278]/24 bg-[#D34278]/9 text-[#FFD7E4]",
    };
  }

  if (run.status === "rate_limited") {
    return {
      title: "Rate limited",
      body: run.retryAfterSeconds
        ? `Discogs asked WAXLIST to wait about ${run.retryAfterSeconds.toLocaleString()} seconds.`
        : "Discogs rate limit reached. Resume import shortly.",
      icon: Clock3,
      tone: "border-[#F08A4B]/24 bg-[#F08A4B]/9 text-[#FFE1C7]",
    };
  }

  if (run.status === "running") {
    return {
      title: "Import in progress",
      body: `${run.importedCount.toLocaleString()}${run.totalItems ? ` of ${run.totalItems.toLocaleString()}` : ""} records imported so far.`,
      icon: RefreshCw,
      tone: "border-[#1DB954]/22 bg-[#1DB954]/9 text-[#C8F7D8]",
    };
  }

  return {
    title: "Import completed",
    body: `${run.importedCount.toLocaleString()} records imported. Last sync ${formatRelativeImportTime(run.completedAt ?? run.updatedAt)}.`,
    icon: CheckCircle2,
    tone: "border-[#1DB954]/22 bg-[#1DB954]/9 text-[#C8F7D8]",
  };
}

function SyncStatus({
  profile,
  summary,
}: {
  profile: WorkspaceProfile | null;
  summary: WorkspaceSummary | null;
}) {
  const profileLabel = profile?.displayName ?? profile?.id ?? "Spotify session";
  const importStatus = getImportStatusCopy(summary);
  const ImportIcon = importStatus.icon;

  return (
    <section
      className={cn("rounded-2xl border p-4", importStatus.tone)}
      aria-labelledby="sync-status-heading"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full border border-current/20 bg-current/10 p-2">
          <ImportIcon className="size-4" aria-hidden="true" />
        </div>
        <div>
          <h2
            id="sync-status-heading"
            className="text-sm font-semibold text-[#FFF4E8]"
          >
            {importStatus.title}
          </h2>
          <p className="mt-1 text-xs leading-5 text-[#FFF4E8]/58">
            {profileLabel} connected. {importStatus.body}
          </p>
        </div>
      </div>
    </section>
  );
}

const DASHBOARD_SHORTCUTS = [
  {
    id: "wantlist",
    label: "Wantlist",
    href: "/app?view=wantlist",
    icon: Heart,
  },
  {
    id: "shelf",
    label: "Shelf",
    href: "/app?view=shelf",
    icon: Map,
  },
  {
    id: "insights",
    label: "Health",
    href: "/app?view=insights",
    icon: BarChart3,
  },
] as const;

function DashboardHome({
  profile,
  summary,
}: {
  profile: WorkspaceProfile | null;
  summary: WorkspaceSummary | null;
}) {
  const profileLabel = profile?.displayName ?? profile?.id ?? "Collector";
  const importStatus = getImportStatusCopy(summary);
  const dashboardMetrics = [
    {
      id: "collection",
      label: "Collection records",
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
      href: "/app?view=wantlist",
    },
    {
      id: "missing-location",
      label: "Missing location",
      value: summary?.missingLocationCount ?? 0,
      href: "/app?view=shelf",
    },
    {
      id: "duplicates",
      label: "Duplicate groups",
      value: summary?.duplicateCount ?? 0,
      href: "/app?view=insights",
    },
    {
      id: "priority-wants",
      label: "Priority wants",
      value: summary?.priorityWantlistCount ?? 0,
      href: "/app?view=wantlist",
    },
  ];
  const actionRows = [
    {
      id: "import",
      label: summary?.latestImportRun ? "Review Discogs sync" : "Import Discogs collection",
      description: importStatus.body,
      href: "/app?view=collection",
      icon: summary?.latestImportRun?.status === "failed" ? AlertTriangle : RefreshCw,
    },
    {
      id: "shelf",
      label: "Resolve missing shelf locations",
      description:
        summary && summary.missingLocationCount > 0
          ? `${summary.missingLocationCount.toLocaleString()} owned records need room, unit, shelf, or slot.`
          : "Shelf location gaps will appear after owned records are imported.",
      href: "/app?view=shelf",
      icon: Map,
    },
    {
      id: "digging",
      label: "Open Digging mode",
      description:
        summary && summary.collectionCount > 0
          ? "Use imported data for owned, wanted, duplicate, and shelf checks."
          : "Digging mode becomes useful after import or wishlist seeding.",
      href: "/app?view=digging",
      icon: Radar,
    },
  ];

  return (
    <section
      className="mx-auto w-full max-w-5xl px-1 py-8 sm:py-12"
      aria-labelledby="dashboard-heading"
    >
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.28em] text-[#FFF4E8]/42">
          WAXLIST workspace
        </p>
        <h1
          id="dashboard-heading"
          className="mx-auto mt-4 max-w-3xl text-4xl font-semibold leading-tight text-[#FFF4E8] sm:text-5xl"
        >
          What are you working on, {profileLabel}?
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-[#FFF4E8]/58">
          Live collection, wantlist, shelf, duplicate, and import signals from
          the current workspace.
        </p>
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {dashboardMetrics.map((metric) => (
          <Link
            key={metric.id}
            href={metric.href}
            className="rounded-xl border border-[#FFF4E8]/10 bg-[#121014] p-4 transition hover:border-[#FFF4E8]/22 hover:bg-[#171219]"
          >
            <p className="text-xs uppercase tracking-[0.18em] text-[#FFF4E8]/42">
              {metric.label}
            </p>
            <p className="mt-3 text-3xl font-semibold tabular-nums text-[#FFF4E8]">
              {metric.value.toLocaleString()}
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-5 grid gap-3">
        {actionRows.map((action) => {
          const Icon = action.icon;

          return (
            <Link
              key={action.id}
              href={action.href}
              className="group flex items-center justify-between gap-4 rounded-xl border border-[#FFF4E8]/10 bg-[#FFF4E8]/5 px-4 py-4 text-left transition hover:border-[#FFF4E8]/20 hover:bg-[#FFF4E8]/9"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full border border-[#FFF4E8]/16 bg-[#05030A]/56 text-[#FFF4E8]">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[#FFF4E8]">
                    {action.label}
                  </span>
                  <span className="mt-1 block text-sm leading-5 text-[#FFF4E8]/54">
                    {action.description}
                  </span>
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

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {DASHBOARD_SHORTCUTS.map((shortcut) => {
          const Icon = shortcut.icon;

          return (
            <Link
              key={shortcut.id}
              href={shortcut.href}
              className="group flex items-center justify-between rounded-2xl border border-[#FFF4E8]/10 bg-[#FFF4E8]/5 px-4 py-4 text-sm font-medium text-[#FFF4E8]/72 transition hover:border-[#FFF4E8]/20 hover:bg-[#FFF4E8]/9 hover:text-[#FFF4E8]"
            >
              <span className="flex items-center gap-3">
                <Icon className="size-4" aria-hidden="true" />
                {shortcut.label}
              </span>
              <ArrowRight
                className="size-4 text-[#FFF4E8]/36 transition group-hover:translate-x-0.5 group-hover:text-[#FFF4E8]/70"
                aria-hidden="true"
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function WorkspacePanel({ activeView }: { activeView: WorkspaceViewId }) {
  const view = getActiveView(activeView);
  const Icon = view.icon;

  return (
    <section
      className="rounded-2xl border border-[#FFF4E8]/12 bg-[#08030f]/68 p-5 shadow-2xl shadow-black/20"
      aria-labelledby="workspace-view-heading"
    >
      <div className="flex flex-col gap-4 border-b border-[#FFF4E8]/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#FFF4E8]/48">
            <Icon className="size-4" aria-hidden="true" />
            <p className="text-xs uppercase tracking-[0.24em]">Workspace</p>
          </div>
          <h1
            id="workspace-view-heading"
            className="mt-3 text-2xl font-semibold text-[#FFF4E8]"
          >
            {view.label}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#FFF4E8]/62">
            {view.description}
          </p>
        </div>
        <Button
          disabled
          variant="outline"
          className="rounded-full border-[#FFF4E8]/16 bg-[#FFF4E8]/8 px-4 text-[#FFF4E8] disabled:opacity-45"
        >
          <Disc3 className="size-4" aria-hidden="true" />
          Import
        </Button>
      </div>

      <div className="mt-5">
        <div className="rounded-xl border border-dashed border-[#FFF4E8]/12 bg-[#FFF4E8]/4 p-8 text-center">
          <p className="text-sm font-medium text-[#FFF4E8]">
            No records loaded
          </p>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#FFF4E8]/56">
            Import or sync collection data to populate {view.label}.
          </p>
        </div>
      </div>
    </section>
  );
}

function CrateWorkspace({
  initialSpotifyWorkspace,
}: {
  initialSpotifyWorkspace?: SpotifyWorkspaceSnapshot | null;
}) {
  return (
    <section className="min-w-0 py-1" aria-labelledby="crate-heading">
      <div className="mb-5 flex flex-col gap-4 border-b border-[#FFF4E8]/10 pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#FFF4E8]/48">
            <Disc3 className="size-4" aria-hidden="true" />
            <p className="text-xs uppercase tracking-[0.24em]">
              Intake workspace
            </p>
          </div>
          <h1
            id="crate-heading"
            className="mt-3 text-3xl font-semibold text-[#FFF4E8]"
          >
            Crate
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#FFF4E8]/62">
            Use Crate only for Spotify intake, Discogs matching, and reviewing
            recommendations before sending records into Wantlist or Collection.
          </p>
        </div>
      </div>

      <ConnectedWorkspace
        initialWorkspace={initialSpotifyWorkspace}
        showProfilePanel={false}
      />
    </section>
  );
}

function ProfileWorkspace({ profile }: { profile: WorkspaceProfile | null }) {
  const profileName = profile?.displayName ?? profile?.id ?? "Spotify";

  return (
    <section className="min-w-0 py-1" aria-labelledby="profile-heading">
      <div className="mb-6 border-b border-[#FFF4E8]/10 pb-5">
        <div className="flex items-center gap-2 text-[#FFF4E8]/48">
          <UserRound className="size-4" aria-hidden="true" />
          <p className="text-xs uppercase tracking-[0.24em]">Account</p>
        </div>
        <h1
          id="profile-heading"
          className="mt-3 text-3xl font-semibold text-[#FFF4E8]"
        >
          Profile
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#FFF4E8]/62">
          Connected Spotify account details for this WAXLIST session.
        </p>
      </div>

      <div className="max-w-3xl rounded-2xl border border-[#FFF4E8]/10 bg-[#08030f]/48 p-5">
        <div className="flex items-center gap-4">
          {profile?.imageUrl ? (
            <div
              className="size-16 shrink-0 rounded-2xl bg-cover bg-center ring-1 ring-[#FFF4E8]/14"
              style={{ backgroundImage: `url(${profile.imageUrl})` }}
              aria-label={`${profileName} Spotify profile image`}
              role="img"
            />
          ) : (
            <span className="grid size-16 shrink-0 place-items-center rounded-2xl border border-[#1DB954]/24 bg-[#1DB954]/12 text-[#1DB954]">
              <UserRound className="size-7" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.24em] text-[#FFF4E8]/42">
              Connected Spotify
            </p>
            <h2 className="mt-2 truncate text-2xl font-semibold text-[#FFF4E8]">
              {profileName}
            </h2>
          </div>
        </div>

        <dl className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[#FFF4E8]/8 bg-[#FFF4E8]/5 p-4">
            <dt className="text-xs text-[#FFF4E8]/45">Plan</dt>
            <dd className="mt-2 text-sm font-medium capitalize text-[#FFF4E8]">
              {profile?.product ?? "Spotify"}
            </dd>
          </div>
          <div className="rounded-xl border border-[#FFF4E8]/8 bg-[#FFF4E8]/5 p-4">
            <dt className="text-xs text-[#FFF4E8]/45">Region</dt>
            <dd className="mt-2 text-sm font-medium text-[#FFF4E8]">
              {profile?.country ?? "Unset"}
            </dd>
          </div>
          <div className="rounded-xl border border-[#FFF4E8]/8 bg-[#FFF4E8]/5 p-4">
            <dt className="text-xs text-[#FFF4E8]/45">Spotify ID</dt>
            <dd className="mt-2 truncate text-sm font-medium text-[#FFF4E8]">
              {profile?.id ?? "Unavailable"}
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {profile?.externalUrl ? (
            <Button
              asChild
              variant="outline"
              className="rounded-full border-[#FFF4E8]/14 bg-[#FFF4E8]/8 text-[#FFF4E8] hover:bg-[#FFF4E8]/14"
            >
              <a href={profile.externalUrl} target="_blank" rel="noreferrer">
                Open Spotify
              </a>
            </Button>
          ) : null}
          <form action={SPOTIFY_AUTH_LOGOUT_PATH} method="post">
            <Button
              type="submit"
              variant="outline"
              className="w-full rounded-full border-[#FFF4E8]/14 bg-transparent text-[#FFF4E8]/72 hover:bg-[#FFF4E8]/10 hover:text-[#FFF4E8] sm:w-auto"
            >
              Sign Out
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}

export function AppShell({
  activeView,
  profile,
  initialSpotifyWorkspace,
  initialWorkspaceSummary = null,
  initialSearchQuery = "",
}: AppShellProps) {
  const activeWorkspaceView = getActiveView(activeView);
  const [selectedRecord, setSelectedRecord] = useState<SelectedRecord | null>(
    null,
  );
  const hasSharedInspector =
    activeView === "collection" ||
    activeView === "wantlist" ||
    activeView === "digging" ||
    activeView === "shelf" ||
    activeView === "insights";
  const activeViewKey = `${activeView}:${initialSearchQuery}`;

  return (
    <main className="min-h-screen bg-[#05030A] text-[#FFF4E8]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_52%_10%,rgba(211,66,120,0.13),transparent_26%),radial-gradient(circle_at_82%_18%,rgba(240,138,75,0.08),transparent_22%),linear-gradient(180deg,rgba(12,10,15,0.94),rgba(5,3,10,0.98))]" />
      <div className="relative mx-auto flex min-h-screen w-full flex-col gap-5 px-3 py-3 sm:px-4 lg:grid lg:grid-cols-[12.5rem_minmax(0,1fr)] lg:py-4">
        <aside className="rounded-2xl border border-[#FFF4E8]/8 bg-[#08030f]/48 p-4 shadow-2xl shadow-black/20 lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
          <div className="flex items-center justify-between gap-3 lg:block">
            <Link href="/" className="inline-flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full border border-[#FFF4E8]/16 bg-[#FFF4E8]/8 font-serif text-lg italic">
                W
              </span>
              <span>
                <span className="block font-serif text-xl italic leading-none">
                  {APP_NAME}
                </span>
              </span>
            </Link>
            <form action={SPOTIFY_AUTH_LOGOUT_PATH} method="post">
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="rounded-full border-[#FFF4E8]/14 bg-transparent text-[#FFF4E8]/72 hover:bg-[#FFF4E8]/10 hover:text-[#FFF4E8] lg:hidden"
              >
                Sign Out
              </Button>
            </form>
          </div>

          <div className="mt-5">
            <WorkspaceConnectionStatus
              profile={profile}
              summary={initialWorkspaceSummary}
            />
          </div>

          <div className="mt-5 lg:mt-8">
            <WorkspaceNav activeView={activeView} />
          </div>

          <div className="mt-5">
            <ProfileNavLink activeView={activeView} />
            <form
              action={SPOTIFY_AUTH_LOGOUT_PATH}
              method="post"
              className="mt-4 hidden lg:block"
            >
              <Button
                type="submit"
                variant="outline"
                className="w-full rounded-full border-[#FFF4E8]/14 bg-transparent text-[#FFF4E8]/72 hover:bg-[#FFF4E8]/10 hover:text-[#FFF4E8]"
              >
                Sign Out
              </Button>
            </form>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-5">
          <header className="rounded-2xl border border-[#FFF4E8]/8 bg-[#08030f]/46 p-4 shadow-2xl shadow-black/20">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[#FFF4E8]/45">
                  Workspace
                </p>
                <h1 className="mt-2 text-2xl font-semibold text-[#FFF4E8]">
                  {activeWorkspaceView.label}
                </h1>
              </div>
              <GlobalWorkspaceSearch
                key={`${activeView}:${initialSearchQuery}`}
                activeView={activeView}
                initialQuery={initialSearchQuery}
              />
            </div>
            <div className="mt-4 lg:hidden">
              <SyncStatus
                profile={profile}
                summary={initialWorkspaceSummary}
              />
            </div>
          </header>

          {activeView === "dashboard" ? (
            <DashboardHome
              profile={profile}
              summary={initialWorkspaceSummary}
            />
          ) : hasSharedInspector ? (
            <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
              {activeView === "collection" ? (
                <CollectionWorkspaceFrame
                  key={activeViewKey}
                  initialQuery={initialSearchQuery}
                  selectedRecord={selectedRecord}
                  onSelectRecord={setSelectedRecord}
                />
              ) : activeView === "wantlist" ? (
                <WantlistWorkspaceFrame
                  key={activeViewKey}
                  initialQuery={initialSearchQuery}
                  selectedRecord={selectedRecord}
                  onSelectRecord={setSelectedRecord}
                />
              ) : activeView === "digging" ? (
                <DiggingWorkspaceFrame
                  key={activeViewKey}
                  initialQuery={initialSearchQuery}
                  selectedRecord={selectedRecord}
                  onSelectRecord={setSelectedRecord}
                />
              ) : activeView === "shelf" ? (
                <ShelfWorkspaceFrame
                  key={activeViewKey}
                  initialQuery={initialSearchQuery}
                  selectedRecord={selectedRecord}
                  onSelectRecord={setSelectedRecord}
                />
              ) : (
                <HealthWorkspaceFrame
                  selectedRecord={selectedRecord}
                  onSelectRecord={setSelectedRecord}
                />
              )}
              <SelectedRecordInspector
                record={selectedRecord}
                onRecordChange={setSelectedRecord}
              />
            </div>
          ) : activeView === "crate" ? (
            <CrateWorkspace initialSpotifyWorkspace={initialSpotifyWorkspace} />
          ) : activeView === "profile" ? (
            <ProfileWorkspace profile={profile} />
          ) : (
            <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
              <WorkspacePanel activeView={activeView} />
              <SelectedRecordInspector
                record={selectedRecord}
                onRecordChange={setSelectedRecord}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
