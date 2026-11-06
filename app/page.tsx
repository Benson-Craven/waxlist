import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  AUTH_SIGN_IN_PATH,
  AUTH_SIGN_UP_PATH,
  HOME_PAGE_COPY,
} from "@/lib/constants";
import { LiquidGradientCanvas } from "@/components/ui/liquid-gradient";
import { getNeonAuthSession } from "@/lib/auth/server";
import { getAppUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

const LANDING_GRADIENT_PRESETS = {
  sunset: {
    colors: ["#3b0f6f", "#8b2fc9", "#e84a8a", "#ffae5c"],
    speed: 0.6,
    scale: 0.5,
    seed: 8,
    turbAmp: 0.5,
    turbFreq: 0.6,
    turbIter: 8,
    waveFreq: 2.5,
    distBias: 0.1,
    ditherMode: "smooth",
    dither: 0.06,
    exposure: 1.2,
    contrast: 1.15,
    saturation: 1.1,
  },
  subtleDark: {
    colors: ["#050505", "#0f0f0f", "#0a0a0a", "#1a1a1a", "#141414"],
    speed: 1.0,
    scale: 0.4,
    seed: 3,
    turbAmp: 0.5,
    turbFreq: 0.6,
    turbIter: 8,
    waveFreq: 2.5,
    distBias: 0,
    ditherMode: "off",
    dither: 0.06,
    exposure: 1.1,
    contrast: 1.1,
    saturation: 1.0,
  },
  vibrant: {
    colors: ["#ff0055", "#0055ff", "#00ffaa", "#ffaa00", "#7700ff"],
    speed: 0.6,
    scale: 0.5,
    seed: 42,
    turbAmp: 0.5,
    turbFreq: 0.6,
    turbIter: 8,
    waveFreq: 2.5,
    distBias: 0.1,
    ditherMode: "smooth",
    dither: 0.06,
    exposure: 1.2,
    contrast: 1.2,
    saturation: 1.2,
  },
  aurora: {
    colors: ["#051105", "#0a3311", "#055533", "#11aa44", "#0a1122"],
    speed: 0.4,
    scale: 0.6,
    seed: 12,
    turbAmp: 0.6,
    turbFreq: 0.8,
    turbIter: 10,
    waveFreq: 1.5,
    distBias: -0.2,
    ditherMode: "grain",
    dither: 0.04,
    exposure: 1.3,
    contrast: 1.15,
    saturation: 1.1,
  },
  magma: {
    colors: ["#110000", "#330500", "#661100", "#aa3300", "#ff6600"],
    speed: 0.8,
    scale: 0.3,
    seed: 7,
    turbAmp: 0.5,
    turbFreq: 0.6,
    turbIter: 8,
    waveFreq: 3.0,
    distBias: 0.3,
    ditherMode: "smooth",
    dither: 0.06,
    exposure: 1.2,
    contrast: 1.3,
    saturation: 1.3,
  },
} as const;

type LandingGradientPresetName = keyof typeof LANDING_GRADIENT_PRESETS;

const DEFAULT_LANDING_GRADIENT_PRESET =
  "sunset" satisfies LandingGradientPresetName;

function RecordIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 3v7M12 14v7" />
    </svg>
  );
}

function getFirstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getLandingGradientPreset(value: string | string[] | undefined) {
  const requestedPreset = getFirstSearchParam(value);

  if (requestedPreset && requestedPreset in LANDING_GRADIENT_PRESETS) {
    return {
      name: requestedPreset as LandingGradientPresetName,
      params:
        LANDING_GRADIENT_PRESETS[requestedPreset as LandingGradientPresetName],
    };
  }

  return {
    name: DEFAULT_LANDING_GRADIENT_PRESET,
    params: LANDING_GRADIENT_PRESETS[DEFAULT_LANDING_GRADIENT_PRESET],
  };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    gradient?: string | string[];
  }>;
}) {
  const [resolvedSearchParams, session] = await Promise.all([
    searchParams,
    getNeonAuthSession(),
  ]);

  if (session.ok) {
    redirect(getAppUrl("/app").toString());
  }

  const landingGradient = getLandingGradientPreset(
    resolvedSearchParams.gradient,
  );
  const spotifySignUpUrl = getAppUrl(
    `${AUTH_SIGN_UP_PATH}?source=spotify`,
  ).toString();
  const listenBrainzSignUpUrl = getAppUrl(
    `${AUTH_SIGN_UP_PATH}?source=listenbrainz`,
  ).toString();
  const youtubeSignUpUrl = getAppUrl(
    `${AUTH_SIGN_UP_PATH}?source=youtube`,
  ).toString();
  const signInUrl = getAppUrl(AUTH_SIGN_IN_PATH).toString();

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <LiquidGradientCanvas
        key={landingGradient.name}
        colors={[...landingGradient.params.colors]}
        aria-hidden="true"
        speed={landingGradient.params.speed}
        scale={landingGradient.params.scale}
        seed={landingGradient.params.seed}
        turbAmp={landingGradient.params.turbAmp}
        turbFreq={landingGradient.params.turbFreq}
        turbIter={landingGradient.params.turbIter}
        waveFreq={landingGradient.params.waveFreq}
        distBias={landingGradient.params.distBias}
        ditherMode={landingGradient.params.ditherMode}
        dither={landingGradient.params.dither}
        exposure={landingGradient.params.exposure}
        contrast={landingGradient.params.contrast}
        saturation={landingGradient.params.saturation}
        fallbackColor={landingGradient.params.colors[0]}
        respectReducedMotion
        pauseWhenHidden
        className="absolute inset-0 h-full w-full"
      />

      <div className="absolute inset-0 bg-black/35" aria-hidden="true" />

      <section
        className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center"
        aria-labelledby="home-heading"
      >
        <p className="mb-5 text-xs uppercase tracking-[0.45em] text-white/60">
          {HOME_PAGE_COPY.eyebrow}
        </p>

        <h1
          id="home-heading"
          className="font-serif text-7xl italic tracking-tight text-white sm:text-8xl md:text-9xl"
        >
          {HOME_PAGE_COPY.title}
        </h1>

        <p className="mt-6 max-w-xl text-balance text-base text-white/75 sm:text-lg">
          {HOME_PAGE_COPY.tagline}
        </p>

        <Button
          asChild
          className="mt-10 cursor-pointer rounded-full bg-[#FFF4E8] px-8 py-6 text-base font-semibold text-[#05030A] shadow-[0_0_42px_rgba(255,244,232,0.18)] transition hover:-translate-y-0.5 hover:bg-[#f6dfc9] hover:shadow-[0_0_54px_rgba(255,244,232,0.26)] focus-visible:ring-2 focus-visible:ring-[#FFF4E8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#05030A]"
        >
          <Link
            href={spotifySignUpUrl}
            aria-label="Start with Spotify"
          >
            <RecordIcon />
            {HOME_PAGE_COPY.cta}
          </Link>
        </Button>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-white/70">
          <Link
            href={listenBrainzSignUpUrl}
            className="underline decoration-white/25 underline-offset-4 transition hover:text-white"
          >
            Use ListenBrainz
          </Link>
          <Link
            href={youtubeSignUpUrl}
            className="underline decoration-white/25 underline-offset-4 transition hover:text-white"
          >
            Add YouTube links
          </Link>
        </div>

        <p className="mt-5 max-w-md text-balance text-xs leading-6 text-white/60 sm:text-sm">
          {HOME_PAGE_COPY.privacy}{" "}
          <Link
            href="/privacy"
            className="font-medium text-white/75 underline-offset-4 hover:text-white hover:underline"
          >
            {HOME_PAGE_COPY.privacyLinkLabel}
          </Link>
          {" · "}
          <Link
            href="/data-deletion"
            className="font-medium text-white/75 underline-offset-4 hover:text-white hover:underline"
          >
            {HOME_PAGE_COPY.deletionLinkLabel}
          </Link>
        </p>

        <p className="mt-4 text-xs text-white/55">
          Already have an account?{" "}
          <Link
            href={signInUrl}
            className="font-medium text-white/80 underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
