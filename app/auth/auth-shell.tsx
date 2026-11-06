import Link from "next/link";

import { AuthForm } from "@/app/auth/auth-form";
import { getAuthStatusMessage } from "@/lib/auth/notices";
import type { CrateSource } from "@/lib/listening/sources";

export function AuthShell({
  mode,
  eyebrow,
  title,
  description,
  source,
  next,
  status,
}: {
  mode: "sign-in" | "sign-up";
  eyebrow: string;
  title: string;
  description: string;
  source: CrateSource;
  next: string;
  status?: string | string[];
}) {
  const notice = getAuthStatusMessage(status);

  return (
    <main className="grid min-h-svh place-items-center bg-[#05030A] px-6 py-12 text-[#FFF4E8]">
      <section className="w-full max-w-md rounded-3xl border border-[#FFF4E8]/12 bg-[#160A24]/48 p-7 shadow-2xl shadow-black/30">
        <Link href="/" className="font-serif text-2xl italic">
          WAXLIST
        </Link>
        <p className="mt-8 text-xs uppercase tracking-[0.28em] text-[#FFF4E8]/42">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[#FFF4E8]/58">
          {description}
        </p>
        {notice ? (
          <p
            role="status"
            className="mt-5 rounded-xl border border-[#FFF4E8]/14 bg-[#FFF4E8]/5 px-4 py-3 text-sm leading-6 text-[#FFF4E8]/78"
          >
            {notice}
          </p>
        ) : null}
        <AuthForm mode={mode} source={source} next={next} />
      </section>
    </main>
  );
}
