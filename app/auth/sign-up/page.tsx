import { redirect } from "next/navigation";

import { AuthShell } from "@/app/auth/auth-shell";
import { getCanonicalOriginRedirectUrl } from "@/lib/auth/canonical-origin";
import { buildAuthPagePath, getSafeNextPath } from "@/lib/auth/redirects";
import { getNeonAuthSession } from "@/lib/auth/server";
import { getCrateHref, getCrateSource } from "@/lib/listening/sources";

export const dynamic = "force-dynamic";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{
    source?: string | string[];
    next?: string | string[];
    status?: string | string[];
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const source = getCrateSource(resolvedSearchParams.source);
  const next = getSafeNextPath(
    resolvedSearchParams.next,
    getCrateHref(source),
  );
  const canonicalRedirect = await getCanonicalOriginRedirectUrl(
    buildAuthPagePath({
      pathname: "/auth/sign-up",
      source,
      next,
      status: resolvedSearchParams.status,
    }),
  );

  if (canonicalRedirect) {
    redirect(canonicalRedirect);
  }

  const session = await getNeonAuthSession();

  if (session.ok) {
    redirect(next);
  }

  return (
    <AuthShell
      mode="sign-up"
      eyebrow="Invite-only beta"
      title="Create your account"
      description="One account for your shelf, wantlist, and listening sources."
      source={source}
      next={next}
      status={resolvedSearchParams.status}
    />
  );
}
