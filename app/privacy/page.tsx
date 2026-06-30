import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

const policySections = [
  {
    title: "What WAXLIST Collects",
    body: "WAXLIST requests the minimum Spotify access needed for the MVP: private and collaborative playlist reads and saved album reads. The app uses your Spotify user id, display name, image, country, product tier, playlists, saved albums, track metadata, and album metadata to build vinyl recommendations. WAXLIST does not return your Spotify email address to the browser.",
  },
  {
    title: "How Data Is Used",
    body: "Spotify data is used to create album search units, query Discogs server-side, rank vinyl matches, and explain why a record was recommended. Discogs requests use server-side credentials and a configured User-Agent. Provider tokens and secrets are never exposed to client-side React code.",
  },
  {
    title: "What WAXLIST Stores",
    body: "WAXLIST stores encrypted Spotify session cookies in the browser, API cache rows for Spotify and Discogs responses, and wishlist records in the configured database. When you are connected to Spotify, wishlist items are associated with your Spotify user id. If Spotify is unavailable, wishlist items may be associated with a hashed fallback session cookie.",
  },
  {
    title: "Logout And Revocation",
    body: "Signing out clears WAXLIST's local Spotify session and OAuth state cookies. It does not revoke WAXLIST from your Spotify account. To revoke access at Spotify, open your Spotify account Apps page and remove WAXLIST from connected apps.",
  },
  {
    title: "Data Deletion",
    body: "Use the data deletion page to delete the current connected user's database-backed profile, imports, matches, and wishlist records, or to delete the fallback-session wishlist records for this browser. It also clears local WAXLIST session cookies.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#05030A] px-6 py-12 text-[#FFF4E8] sm:py-16">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="text-sm font-medium text-[#FFF4E8]/70 underline-offset-4 hover:text-[#FFF4E8] hover:underline"
        >
          Back to {APP_NAME}
        </Link>

        <header className="mt-10">
          <p className="text-xs uppercase tracking-[0.35em] text-[#FFF4E8]/45">
            Privacy
          </p>
          <h1 className="mt-4 font-serif text-5xl italic tracking-tight sm:text-6xl">
            Privacy Policy
          </h1>
          <p className="mt-5 text-sm leading-7 text-[#FFF4E8]/70">
            Last updated: June 30, 2026. This MVP is designed to use Spotify and
            Discogs data only to build your vinyl crate.
          </p>
        </header>

        <div className="mt-10 space-y-8">
          {policySections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-semibold">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[#FFF4E8]/72">
                {section.body}
              </p>
            </section>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            href="/data-deletion"
            className="rounded-full bg-[#1DB954] px-5 py-3 text-sm font-semibold text-[#041008] transition hover:bg-[#22d162]"
          >
            Data deletion
          </Link>
          <a
            href="https://www.spotify.com/account/apps/"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-[#FFF4E8] transition hover:bg-white/10"
          >
            Spotify connected apps
          </a>
        </div>
      </div>
    </main>
  );
}
