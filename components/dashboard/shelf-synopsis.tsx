import type { CollectionSynopsis } from "@/lib/collection/synopsis";

/**
 * The Dashboard lead: one sentence about the shelf plus four quiet facts.
 * It replaces the orbit carousel there; the Collection page keeps the carousel.
 */
export function ShelfSynopsis({ synopsis }: { synopsis: CollectionSynopsis }) {
  return (
    <section aria-labelledby="shelf-synopsis-heading" className="relative">
      <p className="text-[0.62rem] font-medium uppercase tracking-[0.22em] text-[#FFF4E8]/42">
        Shelf synopsis
      </p>
      <h2
        id="shelf-synopsis-heading"
        className="mt-3 max-w-[32ch] font-serif text-[clamp(1.7rem,3.4vw,2.7rem)] italic leading-[1.08] tracking-[-0.015em] text-[#FFF4E8]"
      >
        {synopsis.headline}
      </h2>

      <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-7 border-t border-[#FFF4E8]/10 pt-6 sm:grid-cols-4">
        {synopsis.facts.map((fact) => (
          <div key={fact.id} className="min-w-0">
            <dt className="text-[0.62rem] uppercase tracking-[0.18em] text-[#FFF4E8]/42">
              {fact.label}
            </dt>
            <dd className="mt-2 font-serif text-lg italic leading-tight text-[#FFF4E8] sm:text-xl">
              {fact.value}
            </dd>
            {fact.detail ? (
              <dd className="mt-1.5 text-[11px] tabular-nums text-[#FFF4E8]/45">
                {fact.detail}
              </dd>
            ) : null}
          </div>
        ))}
      </dl>
    </section>
  );
}
