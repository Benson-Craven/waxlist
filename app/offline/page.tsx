import type { Metadata } from "next";
import Link from "next/link";
import { Disc3, RefreshCw } from "lucide-react";

export const metadata: Metadata = {
  title: "Offline · WAXLIST",
};

export default function OfflinePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#05030A] px-6 py-16 text-[#FFF4E8]">
      <div className="w-full max-w-lg rounded-3xl border border-[#FFF4E8]/12 bg-[#08030F]/80 p-8 shadow-2xl shadow-black/40">
        <div className="flex items-center gap-3 text-[#FFF4E8]/48">
          <Disc3 className="size-4" aria-hidden="true" />
          <p className="text-xs uppercase tracking-[0.28em]">WAXLIST</p>
        </div>

        <h1 className="mt-5 text-3xl font-semibold leading-tight">
          No connection, no problem.
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#FFF4E8]/62">
          This page lives on your device. Your last collection view and shelf
          search should still open. Anything that needs Discogs or Spotify waits
          until you’re back.
        </p>

        <div className="mt-6 grid gap-2 rounded-2xl border border-[#FFF4E8]/10 bg-[#FFF4E8]/5 p-4 text-sm leading-6 text-[#FFF4E8]/62">
          <p>
            If a page won’t open, reconnect and reload once so WAXLIST can cache
            it again.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/app"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#FFF4E8] px-5 text-sm font-semibold text-[#08030F] transition hover:bg-[#F6DFC9]"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Try the workspace
          </Link>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-full border border-[#FFF4E8]/14 bg-[#FFF4E8]/7 px-5 text-sm font-medium text-[#FFF4E8]/76 transition hover:bg-[#FFF4E8]/12 hover:text-[#FFF4E8]"
          >
            Back to the start
          </Link>
        </div>
      </div>
    </main>
  );
}
