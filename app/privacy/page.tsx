import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

const policySections = [
  {
    title: "What WAXLIST Collects",
    body: "Your Managed Neon Auth account, plus the sources you connect: Spotify playlists and saved albums, public ListenBrainz listens, YouTube links you paste, and pressing evidence you enter.",
  },
  {
    title: "How Data Is Used",
    body: "WAXLIST turns albums into search units, matches them to Discogs releases server-side, and compares them with what you own or want. Provider tokens never reach the browser.",
  },
  {
    title: "What WAXLIST Stores",
    body: "Your collection and wantlist state, the latest successful snapshot per source, saved pressing evidence, and candidate IDs. Raw ListenBrainz responses aren't kept, YouTube links aren't fetched, and public Discogs cache entries expire within an hour. Pressing searches leave out images, marketplace, seller, collection, wantlist, and Discogs user data.",
  },
  {
    title: "Anonymous Pressing Preview",
    body: "With the pressing-proof beta on, you can check one investigation for 24 hours. A signed cookie ties the preview to one release family, and hashed network addresses are used only for abuse limits. Saving or resuming needs an account.",
  },
  {
    title: "Spotify Connection",
    body: "Spotify links to a signed-in WAXLIST account. OAuth state and encrypted sessions are account-bound, and a matching unclaimed legacy account is claimed under a lock or not at all.",
  },
  {
    title: "Data Deletion",
    body: "The deletion page removes your account data, listening snapshots, catalogue matches, pressing investigations, collection and wantlist state, linked credentials, and session cookies.",
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
            Last updated: July 30, 2026. The invite-only beta builds a crate
            from Spotify, ListenBrainz, or links you supply, matched against
            Discogs catalogue data.
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
        </div>
      </div>
    </main>
  );
}
