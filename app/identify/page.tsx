import Link from "next/link";
import { notFound } from "next/navigation";

import { PressingIdentificationWorkspace } from "@/components/pressing-proof/pressing-identification-workspace";
import { getServerCapabilities } from "@/lib/capabilities/server";

export const dynamic = "force-dynamic";

export default async function IdentifyPressingPage() {
  if (!getServerCapabilities().pressingProof) {
    notFound();
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05030A] px-4 py-6 text-[#FFF4E8] sm:px-6 sm:py-10">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(211,66,120,0.18),transparent_30%),radial-gradient(circle_at_85%_18%,rgba(240,138,75,0.09),transparent_24%)]"
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-5xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="font-serif text-2xl italic tracking-tight text-[#FFF4E8]"
          >
            WAXLIST
          </Link>
          <Link
            href="/auth/sign-in?next=%2Fidentify"
            className="text-sm text-[#FFF4E8]/58 hover:text-[#FFF4E8]"
          >
            Sign in
          </Link>
        </header>

        <PressingIdentificationWorkspace />
      </div>
    </main>
  );
}
