import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WAXLIST",
    short_name: "WAXLIST",
    description:
      "A vinyl collection workspace for searching your shelf, digging in shops, and keeping the wantlist honest.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#05030A",
    theme_color: "#05030A",
    icons: [
      {
        src: "/icons/waxlist-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/waxlist-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/waxlist-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
