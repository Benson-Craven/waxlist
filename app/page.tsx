import { Button } from "@/components/ui/button";
import { HOME_PAGE_COPY, SPOTIFY_AUTH_START_PATH } from "@/lib/constants";
import {
  LiquidGradientCanvas,
  LIQUID_GRADIENT_PRESETS,
} from "@/components/ui/liquid-gradient";

function SpotifyLogo() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5 shrink-0"
      fill="#1DB954"
    >
      <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0Zm5.5 17.3a.75.75 0 0 1-1.03.25c-2.82-1.72-6.38-2.11-10.57-1.16a.75.75 0 1 1-.33-1.46c4.59-1.05 8.53-.59 11.68 1.33.35.21.47.68.25 1.04Zm1.46-3.25a.94.94 0 0 1-1.29.31c-3.23-1.99-8.16-2.56-11.98-1.4a.94.94 0 0 1-.55-1.8c4.36-1.32 9.78-.68 13.5 1.61.45.27.59.85.32 1.28Zm.12-3.39C15.2 8.36 8.8 8.15 5.08 9.3a1.12 1.12 0 1 1-.66-2.15c4.27-1.31 11.34-1.06 15.81 1.59a1.12 1.12 0 0 1-1.15 1.92Z" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <LiquidGradientCanvas
        {...LIQUID_GRADIENT_PRESETS.sunset}
        aria-hidden="true"
        speed={0.35}
        respectReducedMotion
        pauseWhenOffscreen
        pauseWhenHidden
        className="absolute inset-0 h-full w-full"
      />

      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />

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
          className="mt-10 cursor-pointer rounded-full px-8 py-6 text-base font-medium"
        >
          <a
            href={SPOTIFY_AUTH_START_PATH}
            aria-label="Connect Spotify to start building your vinyl crate"
          >
            <SpotifyLogo />
            {HOME_PAGE_COPY.cta}
          </a>
        </Button>

        <p className="mt-5 max-w-md text-balance text-xs leading-6 text-white/60 sm:text-sm">
          {HOME_PAGE_COPY.privacy}
        </p>
      </section>
    </main>
  );
}
