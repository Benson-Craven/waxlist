import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

type DataDeletionPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function DataDeletionPage({
  searchParams,
}: DataDeletionPageProps) {
  const { error } = await searchParams;

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
            This deletes what WAXLIST controls for your signed-in account and
            clears your WAXLIST session cookies.
          </p>
        </header>

        <section className="mt-10 space-y-4 text-sm leading-7 text-[#FFF4E8]/72">
          {error === "auth_identity" ? (
            <div
              role="alert"
              className="rounded-xl border border-[#F08A4B]/24 bg-[#F08A4B]/9 p-4 text-[#FFE1C7]"
            >
              Your data is gone, but the sign-in identity wasn’t removed.
              Contact support before signing in again.
            </div>
          ) : null}
          <p>
            That covers your user row, listening snapshots, catalogue matches,
            pressing investigations, collection and wantlist state, import runs,
            and linked credentials.
          </p>
          <p>
            Shared provider cache rows aren’t account data and expire on their
            own. Public Discogs catalogue entries expire within an hour.
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
        </div>
      </div>
    </main>
  );
}
