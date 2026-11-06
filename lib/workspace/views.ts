export const WORKSPACE_VIEW_DEFINITIONS = [
  {
    id: "dashboard",
    label: "Dashboard",
  },
  {
    id: "crate",
    label: "Crate",
  },
  {
    id: "collection",
    label: "Collection",
  },
  {
    id: "spins",
    label: "Spins",
  },
  {
    id: "wantlist",
    label: "Wantlist",
  },
  {
    id: "digging",
    label: "Digging",
  },
  {
    id: "insights",
    label: "Health",
  },
  {
    id: "profile",
    label: "Profile",
  },
] as const;

export type WorkspaceViewId = (typeof WORKSPACE_VIEW_DEFINITIONS)[number]["id"];
