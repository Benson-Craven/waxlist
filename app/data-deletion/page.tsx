import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export default function DataDeletionPage() {
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
            Data deletion
          </p>
          <h1 className="mt-4 font-serif text-5xl italic tracking-tight sm:text-6xl">
            Delete WAXLIST Data
          </h1>
          <p className="mt-5 text-sm leading-7 text-[#FFF4E8]/70">
            This deletes data WAXLIST controls for the current connected Spotify
            user, or fallback wishlist data tied to this browser session. It
            also clears WAXLIST session cookies.
          </p>
        </header>

        <section className="mt-10 space-y-4 text-sm leading-7 text-[#FFF4E8]/72">
          <p>
            Deleted database records include your WAXLIST user row, Spotify
            import summaries, Discogs match rows created from those imports, and
            wishlist items. Shared provider cache rows may expire separately and
            are not used as account records.
          </p>
          <p>
            This action does not revoke WAXLIST inside Spotify. To revoke access
            at Spotify, remove WAXLIST from your Spotify account Apps page.
          </p>
        </section>

        <form action="/api/privacy/delete-data" method="post" className="mt-10">
          <button
            type="submit"
            className="rounded-full bg-[#1DB954] px-6 py-3 text-sm font-semibold text-[#041008] shadow-[0_0_40px_rgba(29,185,84,0.22)] transition hover:bg-[#22d162] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF4E8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#05030A]"
          >
            Delete my WAXLIST data
          </button>
        </form>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/privacy"
            className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-[#FFF4E8] transition hover:bg-white/10"
          >
            Privacy policy
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
