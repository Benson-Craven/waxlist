export const WORKSPACE_VIEW_DEFINITIONS = [
  {
    id: "dashboard",
    label: "Dashboard",
    description:
      "Taste-led discovery, collection status, and quick workspace launchers.",
  },
  {
    id: "crate",
    label: "Crate",
    description:
      "Saved albums and selected playlists matched to vinyl with confidence before buyability.",
  },
  {
    id: "collection",
    label: "Collection",
    description: "Fast owned-record search with duplicate and shelf signals.",
  },
  {
    id: "wantlist",
    label: "Wantlist",
    description: "Priority, price ceiling, shipping, and ignore rules.",
  },
  {
    id: "digging",
    label: "Digging",
    description: "Record-shop lookup for owned, wanted, and duplicate status.",
  },
  {
    id: "shelf",
    label: "Shelf",
    description: "Room, unit, shelf, slot, and missing-location views.",
  },
  {
    id: "insights",
    label: "Health",
    description:
      "Collection integrity audit, duplicates, metadata gaps, and collection gaps.",
  },
  {
    id: "profile",
    label: "Profile",
    description: "Connected Spotify account details and session controls.",
  },
] as const;

export type WorkspaceViewId = (typeof WORKSPACE_VIEW_DEFINITIONS)[number]["id"];
