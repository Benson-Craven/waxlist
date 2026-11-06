"use client";

import Link from "next/link";
import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { gsap } from "gsap";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Disc3,
  ExternalLink,
} from "lucide-react";

import { RecordQuickActions } from "@/components/records/record-actions";
import { StarRating } from "@/components/ui/star-rating";
import { formatPriceCents } from "@/lib/collection/pricing";
import type { FeaturedCollectionReason } from "@/lib/collection/featured";
import { cn } from "@/lib/utils";
import type { CollectionRecord } from "@/lib/collection/record";

export type VinylOrbitCarouselProps = {
  records: CollectionRecord[];
  /**
   * Why each record is on the stage. Featured records are starred, priced
   * extremes, or both; the label and description say which.
   */
  reasons?: Record<string, FeaturedCollectionReason[]>;
  onRate?: (record: CollectionRecord, rating: number | null) => Promise<void>;
  className?: string;
  /**
   * Fills the available width at the stage's 960x520 ratio so the orbit is the
   * lead surface instead of a fixed-height band with side gutters. The canvas
   * keeps scaling with the stage, so the carousel widens on larger screens.
   */
  fill?: boolean;
  /**
   * Drops the stage's own background, radius, and shadow so it sits directly
   * on a shared gradient surface (the Dashboard) instead of drawing a panel
   * inside it.
   */
  flush?: boolean;
};

type Accent = {
  background: string;
  foreground: string;
};

const ACCENTS: Accent[] = [
  { background: "#D34278", foreground: "#FFF4E8" },
  { background: "#F08A4B", foreground: "#190B03" },
  { background: "#6D2AA8", foreground: "#FFF4E8" },
  { background: "#1DB954", foreground: "#03130A" },
];

const ORBIT_X = 299;
const ORBIT_Y = -450;
const ORBIT_R = 650;
const SWING = 50;
const ITEM = 118;
const VISIBLE = 4;
const ARC_SWEEP = [38, 146];
const ARC_REST = [
  [50, 98],
  [46, 124],
  [60, 126],
  [40, 100],
];

const HIDE_1 = "inset(0% 0% 0% 100%)";
const HIDE_2 = "inset(0% 100% 0% 0%)";
const SHOW = "inset(0% 0% 0% 0%)";

function wrapIndex(value: number, length: number) {
  if (length <= 0) return 0;
  return ((Math.round(value) % length) + length) % length;
}

function stepDirection(from: number, to: number, length: number): 1 | -1 {
  if (length <= 0) return 1;
  const forward = (((to - from) % length) + length) % length;
  return forward <= length - forward ? 1 : -1;
}

function stripStart(index: number, length: number, visible: number) {
  if (length <= visible) return 0;
  return Math.max(0, Math.min(index - 1, length - visible));
}

function fitSize(chars: number, max: number, width: number, em: number) {
  return Math.min(max, width / (Math.max(1, chars) * em));
}

function arcRest(index: number) {
  return ARC_REST[((index % ARC_REST.length) + ARC_REST.length) % ARC_REST.length];
}

function arcPath(
  start: number,
  end: number,
  cx: number,
  cy: number,
  radius: number,
  width: number,
  steps = 48,
) {
  const outer: string[] = [];
  const inner: string[] = [];

  for (let index = 0; index <= steps; index += 1) {
    const progress = index / steps;
    const angle = ((start + (end - start) * progress) * Math.PI) / 180;
    const halfWidth = (width / 2) * Math.pow(Math.sin(Math.PI * progress), 0.45);
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);

    outer.push(
      `${(cx + cosine * (radius + halfWidth)).toFixed(1)} ${(
        cy +
        sine * (radius + halfWidth)
      ).toFixed(1)}`,
    );
    inner.push(
      `${(cx + cosine * (radius - halfWidth)).toFixed(1)} ${(
        cy +
        sine * (radius - halfWidth)
      ).toFixed(1)}`,
    );
  }

  return `M${outer.join("L")}L${inner.reverse().join("L")}Z`;
}

function present<T>(values: Array<T | null | undefined>): T[] {
  return values.filter((value): value is T => Boolean(value));
}

function displayAlbumTitle(record: CollectionRecord) {
  const prefix = `${record.artist} - `;

  return record.title.toLowerCase().startsWith(prefix.toLowerCase())
    ? record.title.slice(prefix.length)
    : record.title;
}

function discogsUrl(record: CollectionRecord) {
  return `https://www.discogs.com/release/${record.discogsReleaseId}`;
}

function featuredPrice(record: CollectionRecord) {
  return record.pricing
    ? formatPriceCents(record.pricing.currentCents, record.pricing.currency)
    : null;
}

function featuredLabel(
  record: CollectionRecord,
  reasons: FeaturedCollectionReason[],
) {
  const price = featuredPrice(record);
  const mostExpensive = reasons.includes("most-expensive");
  const leastExpensive = reasons.includes("least-expensive");

  // One priced record is both extremes. Naming only one would be true but
  // misleading, so the stage says what is actually happening.
  if (mostExpensive && leastExpensive) {
    return price ? `Only priced vinyl · ${price}` : "Only priced vinyl";
  }

  if (mostExpensive) {
    return price ? `Most expensive · ${price}` : "Most expensive";
  }

  if (leastExpensive) {
    return price ? `Least expensive · ${price}` : "Least expensive";
  }

  return "Featured vinyl";
}

function featuredDescription(
  record: CollectionRecord,
  reasons: FeaturedCollectionReason[],
  albumTitle: string,
) {
  const price = featuredPrice(record);
  const mostExpensive = reasons.includes("most-expensive");
  const leastExpensive = reasons.includes("least-expensive");

  if (mostExpensive && leastExpensive && price) {
    return `${price} is the only recorded value in your collection.`;
  }

  if (mostExpensive && price) {
    return `${price} is the highest recorded value in your collection.`;
  }

  if (leastExpensive && price) {
    return `${price} is the lowest recorded value in your collection.`;
  }

  return `${albumTitle} is starred in your ${
    record.status === "owned" ? "collection" : "wantlist"
  }.`;
}

function VinylArtwork({
  record,
  accent,
  mini = false,
}: {
  record: CollectionRecord;
  accent: Accent;
  mini?: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  if (record.imageUrl && !imageFailed) {
    return (
      <span className={cn("wax-art", mini && "wax-art-mini")}>
        <span className="wax-disc" aria-hidden="true" />
        {/* Discogs artwork is a signed CDN asset; fall back to the drawn sleeve
            if the image is unavailable. */}
        <span className="wax-cover-sleeve">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="wax-cover"
            src={record.imageUrl}
            alt=""
            draggable={false}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
          />
        </span>
      </span>
    );
  }

  const albumTitle = displayAlbumTitle(record);
  const titleSize = mini ? 8 : fitSize(albumTitle.length, 19, 190, 0.58);

  return (
    <span
      className={cn("wax-art", mini && "wax-art-mini")}
      style={
        {
          "--wax-art-accent": accent.background,
          "--wax-art-ink": accent.foreground,
        } as CSSProperties
      }
    >
      <span className="wax-disc" aria-hidden="true" />
      <span className="wax-sleeve">
        <span className="wax-sleeve-copy">
          <span className="wax-sleeve-artist">{record.artist}</span>
          <span
            className="wax-sleeve-title"
            style={{ fontSize: `${titleSize}px` }}
          >
            {albumTitle}
          </span>
        </span>
        <span className="wax-sleeve-meta">
          {record.year ?? "WAXLIST"}
          {record.label ? ` · ${record.label}` : ""}
        </span>
      </span>
    </span>
  );
}

const CSS = `
.wax-frame{width:100%;container-type:inline-size;container-name:wax-orbit}
.wax-frame-fill{height:auto}
.wax-root{--color-background:#08030f;--color-foreground:#FFF4E8;--color-primary:#D34278;--color-muted-foreground:rgba(255,244,232,.55);position:relative;width:100%;height:clamp(540px,55vw,700px);overflow:hidden;border-radius:26px;background:var(--wax-stage-gradient);
box-shadow:0 30px 90px -50px rgba(0,0,0,.9);
color:var(--color-foreground);font-family:var(--font-sans),ui-sans-serif,system-ui,sans-serif;-webkit-tap-highlight-color:transparent;isolation:isolate}
.wax-root *{box-sizing:border-box}
.wax-root.wax-fill{height:auto;aspect-ratio:960/520;min-height:clamp(28rem,46svh,60rem)}
.wax-root.wax-flush{background:transparent;border-radius:0;box-shadow:none}
.wax-root:focus-visible{outline:2px solid var(--color-primary);outline-offset:-4px}
.wax-canvas{position:absolute;left:50%;top:50%;width:960px;height:520px;transform:translate(-50%,-50%) scale(var(--wax-s,1));transform-origin:50% 50%}
.wax-arc{position:absolute;left:0;top:0;width:960px;height:520px;overflow:visible;pointer-events:none}
.wax-btn{appearance:none;border:0;background:none;color:inherit;font:inherit;padding:0;margin:0;cursor:pointer;text-decoration:none}
.wax-btn:focus-visible{outline:2px solid var(--color-primary);outline-offset:3px;border-radius:10px}
.wax-ico{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.wax-top{position:absolute;left:800px;top:52px;display:flex;gap:14px}
.wax-top .wax-btn{width:36px;height:36px;display:grid;place-items:center;border-radius:10px;background:rgba(255,244,232,.04);color:rgba(255,244,232,.7);transition:background .2s,color .2s}
.wax-top .wax-btn:hover{background:rgba(255,244,232,.09);color:#FFF4E8}
.wax-pager{position:absolute;left:76px;top:172px;display:flex;flex-direction:column;align-items:center;gap:7px}
.wax-dot{width:14px;height:10px;display:grid;place-items:center}
.wax-dot i{display:block;width:3px;height:3px;border-radius:3px;background:var(--color-foreground);opacity:.45;transition:height .45s cubic-bezier(.3,.7,.2,1),opacity .3s}
.wax-dot[aria-current] i{height:22px;opacity:.9}
.wax-dot[aria-current]{height:26px}
.wax-dot{transition:height .45s cubic-bezier(.3,.7,.2,1)}
.wax-plates{position:absolute;left:130px;top:82px;width:245px;height:245px;touch-action:pan-y;cursor:grab}
.wax-plates:active{cursor:grabbing}
.wax-orbit{position:absolute;inset:0;transform-origin:69% -217%;visibility:hidden;will-change:transform}
.wax-art{position:relative;display:block;width:245px;height:245px;max-width:none;user-select:none;-webkit-user-drag:none;filter:drop-shadow(0 20px 28px rgba(0,0,0,.34)) drop-shadow(0 4px 8px rgba(0,0,0,.2))}
.wax-cover{display:block;width:100%;height:100%;max-width:none;object-fit:cover;border-radius:16px}
.wax-cover-sleeve{position:absolute;left:0;top:0;width:88%;height:100%;overflow:hidden;border-radius:15px;box-shadow:0 22px 32px -18px rgba(0,0,0,.62)}
.wax-cover-sleeve .wax-cover{border-radius:0;box-shadow:none}
.wax-disc{position:absolute;right:-1%;top:13%;width:74%;height:74%;border-radius:50%;background:
radial-gradient(circle at 50% 48%,rgba(255,244,232,.12) 0 2%,transparent 2.6%),
repeating-radial-gradient(circle at 50% 50%,#18131d 0 2px,#09070d 2px 5px),
radial-gradient(circle at 38% 30%,#342a3d,#08060b 62%);
box-shadow:0 14px 20px rgba(0,0,0,.34)}
.wax-sleeve{position:absolute;left:0;top:0;width:88%;height:100%;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;border-radius:15px;padding:15px 14px;background:
linear-gradient(150deg,rgba(255,244,232,.16),transparent 42%),
linear-gradient(145deg,var(--wax-art-accent),color-mix(in oklab,var(--wax-art-accent) 48%,#08030f));
box-shadow:0 22px 32px -18px rgba(0,0,0,.62)}
.wax-sleeve::after{content:"";position:absolute;inset:0;background:
linear-gradient(0deg,rgba(5,3,10,.42),transparent 55%),
radial-gradient(circle at 18% 18%,rgba(255,244,232,.18),transparent 42%);pointer-events:none}
.wax-sleeve-copy{position:relative;z-index:1;display:flex;flex-direction:column;gap:5px;min-width:0}
.wax-sleeve-artist{font-size:9.5px;font-weight:600;line-height:1.25;letter-spacing:.12em;text-transform:uppercase;color:color-mix(in oklab,var(--wax-art-ink) 78%,transparent);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.wax-sleeve-title{font-weight:750;line-height:.98;letter-spacing:-.045em;color:var(--wax-art-ink);overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical}
.wax-sleeve-meta{position:relative;z-index:1;font-size:8.5px;line-height:1.3;letter-spacing:.06em;text-transform:uppercase;color:color-mix(in oklab,var(--wax-art-ink) 68%,transparent);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.wax-head{position:absolute;left:388px;top:96px;width:300px;height:150px}
.wax-hd{position:absolute;inset:0;visibility:hidden}
.wax-eye{font-size:13px;font-weight:600;letter-spacing:.01em;margin:0 0 4px 2px;color:rgba(255,244,232,.55)}
.wax-t1,.wax-t2{display:block;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1;text-transform:uppercase;margin:0}
.wax-t1{font-weight:200;letter-spacing:-.015em;margin-top:6px;color:rgba(255,244,232,.92)}
.wax-t2{font-weight:800;letter-spacing:-.025em;margin-top:6px;color:rgba(255,244,232,.86)}
.wax-acts{position:absolute;left:396px;top:280px;display:flex;gap:30px;font-size:13px;font-weight:500}
.wax-acts .wax-btn{display:flex;align-items:center;gap:9px;padding:4px 0;color:rgba(255,244,232,.7);transition:color .2s}
.wax-acts .wax-btn:hover{color:#FFF4E8}
.wax-acts .wax-ico{width:13px;height:13px}
.wax-acts .wax-fill{fill:currentColor;stroke:none}
.wax-card{position:absolute;right:20px;top:130px;width:228px;min-height:326px;padding:18px 18px 20px;border-radius:20px;background:rgba(12,7,18,.74);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:0 18px 40px -24px rgba(0,0,0,.6);display:flex;flex-direction:column}
.wax-tabs{display:grid;grid-template-columns:1fr 1fr;gap:3px;padding:3px;border-radius:999px;background:rgba(255,244,232,.055);margin-bottom:16px}
.wax-tab{color:var(--color-muted-foreground);font-weight:500;padding:7px 8px;border-radius:999px;text-align:center;font-size:11.5px;letter-spacing:.02em;transition:background .2s,color .2s}
.wax-tab:hover{color:rgba(255,244,232,.86)}
.wax-tab[aria-selected=true]{color:var(--color-foreground);background:rgba(255,244,232,.11);font-weight:600}
.wax-bodies{display:grid;flex:1;min-height:0}
.wax-body{grid-area:1/1;visibility:hidden;display:flex;flex-direction:column;min-height:0}
.wax-rate{position:relative;height:62px;margin:0 0 14px}
.wax-badge{position:absolute;left:0;top:0;width:60px;height:62px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:6px;border-radius:10px}
.wax-badge svg{flex:none;width:11px;height:11px;fill:rgba(5,3,10,.72);opacity:.8}
.wax-num{font-size:30px;font-weight:700;letter-spacing:-.03em;line-height:1;font-variant-numeric:tabular-nums}
.wax-chef{font-size:20px;font-weight:600;letter-spacing:-.01em;margin:0;color:#FFF4E8}
.wax-kit{font-size:11.5px;color:var(--color-muted-foreground);margin:3px 0 12px}
.wax-desc{font-size:13.5px;line-height:1.42;margin:0;min-height:52px;color:rgba(255,244,232,.76);overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical}
.wax-formats{display:flex;flex-wrap:wrap;gap:7px;margin:0;padding:0;list-style:none;min-height:52px;align-content:flex-start}
.wax-formats li{font-size:11.5px;line-height:1.3;padding:7px 12px;border-radius:8px;background:rgba(255,244,232,.07);color:rgba(255,244,232,.78)}
.wax-formats .wax-format-empty{background:none;padding-left:0;color:rgba(255,244,232,.46);font-size:12.5px;line-height:1.42}
.wax-rate-control{display:grid;gap:7px;margin-top:16px;padding-top:12px}
.wax-rate-meta{display:flex;align-items:center;justify-content:space-between;gap:8px}
.wax-rate-label{font-size:11px;line-height:1.3;color:rgba(255,244,232,.5)}
.wax-rate-msg{height:14px;margin:5px 0 0;font-size:10.5px;line-height:1.4;color:rgba(255,244,232,.48);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.wax-status{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,244,232,.56)}
.wax-status i{display:block;width:5px;height:5px;border-radius:50%;background:currentColor}
.wax-strip{position:absolute;left:130px;top:362px;width:550px;height:122px;display:flex;align-items:center}
.wax-arrow{width:36px;height:36px;display:grid;place-items:center;flex:none;color:rgba(255,244,232,.58);transition:color .2s}
.wax-arrow:hover{color:#FFF4E8}
.wax-arrow svg{width:12px;height:16px;fill:currentColor}
.wax-win{position:relative;width:${ITEM * VISIBLE}px;height:122px;overflow:hidden;flex:none;margin:0 2px;-webkit-mask-image:linear-gradient(90deg,#000 88%,transparent);mask-image:linear-gradient(90deg,#000 88%,transparent)}
.wax-track{position:absolute;left:0;top:0;display:flex;transition:transform .6s cubic-bezier(.65,0,.35,1)}
.wax-th{width:${ITEM}px;height:122px;display:flex;justify-content:center;padding-top:3px}
.wax-th .wax-btn{width:80px;height:116px;border-radius:14px;display:flex;flex-direction:column;align-items:center;gap:7px;padding-top:9px;transition:background .45s}
.wax-th .wax-btn[aria-current]{background:rgba(255,244,232,.08);box-shadow:0 10px 24px -16px rgba(0,0,0,.6)}
.wax-th .wax-art{width:56px;height:56px;filter:drop-shadow(0 4px 6px rgba(0,0,0,.3));transition:transform .45s}
.wax-th .wax-btn[aria-current] .wax-art{transform:scale(1.06)}
.wax-th .wax-sleeve{padding:5px;border-radius:7px}
.wax-th .wax-cover-sleeve{width:100%;border-radius:7px}
.wax-th .wax-disc{display:none}
.wax-th .wax-sleeve-artist,.wax-th .wax-sleeve-meta{display:none}
.wax-th .wax-sleeve-title{font-size:7px;-webkit-line-clamp:3}
.wax-th .wax-btn > span:last-child{font-size:10.5px;line-height:1.3;text-align:center;font-weight:500;color:rgba(255,244,232,.72);max-width:84px;padding:0 4px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.wax-mobile-nav{display:none;align-items:center;gap:14px;font-size:11px;color:rgba(255,244,232,.56)}
.wax-mobile-nav .wax-btn{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:rgba(255,244,232,.05);color:rgba(255,244,232,.8)}
.wax-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@container wax-orbit (max-width:720px){
.wax-root{height:auto;border-radius:22px}
.wax-root.wax-fill{height:auto;min-height:0;aspect-ratio:auto}
.wax-frame-fill{height:auto}
.wax-canvas{position:relative;left:auto;top:auto;width:100%;height:auto;transform:none;display:flex;flex-direction:column;align-items:center;padding:14px 16px 18px}
.wax-arc{width:200%;height:auto;left:-60%;top:-30px}
.wax-top{position:relative;left:auto;top:auto;align-self:flex-end}
.wax-pager{left:6px;top:148px}
.wax-plates{position:relative;left:auto;top:auto;width:min(52vw,32svh);height:min(52vw,32svh);margin-top:0}
.wax-orbit .wax-art{width:100%;height:100%}
.wax-head{position:relative;left:auto;top:auto;width:100%;height:132px;margin-top:10px}
.wax-hd{text-align:center;transform:scale(.78);transform-origin:50% 0}
.wax-acts{position:relative;left:auto;top:auto;margin-top:4px;justify-content:center}
.wax-card{position:relative;left:auto;right:auto;top:auto;width:100%;max-width:430px;min-height:0;margin-top:12px}
.wax-strip{display:none}
.wax-mobile-nav{display:flex}
}
@media (prefers-reduced-motion:reduce){.wax-track,.wax-dot,.wax-dot i,.wax-th .wax-btn,.wax-th .wax-art{transition:none}}
`;

export function VinylOrbitCarousel({
  records,
  reasons,
  onRate,
  className,
  fill = false,
  flush = false,
}: VinylOrbitCarouselProps) {
  const count = records.length;
  const [index, setIndex] = useState(0);
  const [tab, setTab] = useState<"details" | "formats">("details");
  const [pendingRating, setPendingRating] = useState(false);
  const [ratingMessage, setRatingMessage] = useState<string | null>(null);
  const [ratingOverrides, setRatingOverrides] = useState<
    Record<string, number | null>
  >({});

  const rootRef = useRef<HTMLElement | null>(null);
  const orbitRefs = useRef<Array<HTMLDivElement | null>>([]);
  const headRefs = useRef<Array<HTMLDivElement | null>>([]);
  const bodyRefs = useRef<Array<HTMLDivElement | null>>([]);
  const arcRef = useRef<SVGPathElement | null>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const shownRef = useRef(-1);
  const directionRef = useRef<1 | -1>(1);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const recordsRef = useRef(records);

  useLayoutEffect(() => {
    recordsRef.current = records;
  }, [records]);

  const safeIndex = count > 0 ? Math.min(index, count - 1) : 0;
  const record = records[safeIndex];
  const albumTitle = record ? displayAlbumTitle(record) : "";
  const effectiveRating = record
    ? (ratingOverrides[record.id] ?? record.rating ?? null)
    : null;
  const effectiveReasons = record ? (reasons?.[record.id] ?? []) : [];

  useLayoutEffect(() => {
    const element = rootRef.current;

    if (!element) return;

    const fit = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      // The stage is a fixed 960x520 canvas, so letting the canvas scale with
      // the stage is what makes the carousel widen on larger screens. The fill
      // variant therefore keeps scaling; capping it would leave the stage
      // growing around a stalled canvas, giving wide displays permanent side
      // gutters. The fixed-height variant keeps its cap so a short band never
      // renders a giant canvas.
      const scale = Math.min(width / 960, height / 520);

      element.style.setProperty(
        "--wax-s",
        String(Math.max(0.1, fill ? scale : Math.min(scale, 1.35))),
      );
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);

    return () => observer.disconnect();
  }, [fill]);

  useLayoutEffect(() => {
    if (count === 0) return;

    const current = recordsRef.current;
    const to = Math.min(index, current.length - 1);
    const from = shownRef.current >= current.length ? -1 : shownRef.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const parts = (position: number) => {
      const head = headRefs.current[position];

      return {
        orbit: orbitRefs.current[position],
        head,
        eye: head?.querySelector<HTMLElement>(".wax-eye") ?? null,
        t1: head?.querySelector<HTMLElement>(".wax-t1") ?? null,
        t2: head?.querySelector<HTMLElement>(".wax-t2") ?? null,
        body: bodyRefs.current[position],
      };
    };
    const drawArc = () => {
      arcRef.current?.setAttribute(
        "d",
        arcPath(
          arcRef.current.dataset.a0 ? Number(arcRef.current.dataset.a0) : 0,
          arcRef.current.dataset.a1 ? Number(arcRef.current.dataset.a1) : 0,
          ORBIT_X,
          ORBIT_Y,
          ORBIT_R,
          112,
        ),
      );
    };
    const setArc = (a0: number, a1: number) => {
      if (!arcRef.current) return;
      arcRef.current.dataset.a0 = String(a0);
      arcRef.current.dataset.a1 = String(a1);
      drawArc();
    };
    const rest = arcRest(to);
    const tint = ACCENTS[to % ACCENTS.length].background;
    const incoming = parts(to);

    if (timelineRef.current) {
      timelineRef.current.progress(1).kill();
      timelineRef.current = null;
    }

    if (from === -1 || from === to || reduced) {
      for (let position = 0; position < current.length; position += 1) {
        if (position === to) continue;
        const hidden = parts(position);
        gsap.set(present<HTMLElement>([hidden.orbit, hidden.head, hidden.body]), {
          autoAlpha: 0,
        });
      }

      gsap.set(
        present<HTMLElement>([
          incoming.orbit,
          incoming.head,
          incoming.body,
          incoming.eye,
        ]),
        { autoAlpha: 1, rotation: 0, y: 0 },
      );
      gsap.set(present([incoming.t1, incoming.t2]), {
        clipPath: SHOW,
      });
      setArc(rest[0], rest[1]);
      if (arcRef.current) gsap.set(arcRef.current, { fill: tint });
      shownRef.current = to;
      return;
    }

    const outgoing = parts(from);
    const direction = directionRef.current;
    const timeline = gsap.timeline({
      onComplete: () => {
        timelineRef.current = null;
      },
    });

    timelineRef.current = timeline;

    timeline
      .to(outgoing.orbit, {
        rotation: SWING * direction,
        duration: 0.62,
        ease: "power2.in",
      }, 0)
      .set(outgoing.orbit, { autoAlpha: 0, rotation: 0 }, 0.62)
      .fromTo(
        incoming.orbit,
        { autoAlpha: 1, rotation: -SWING * direction },
        { rotation: 0, duration: 0.95, ease: "power3.out" },
        0.3,
      )
      .to(outgoing.t1, {
        clipPath: HIDE_1,
        duration: 0.42,
        ease: "power2.in",
      }, 0)
      .to(outgoing.t2, {
        clipPath: HIDE_2,
        duration: 0.42,
        ease: "power2.in",
      }, 0.06)
      .to(outgoing.eye, { autoAlpha: 0, duration: 0.25 }, 0)
      .set(outgoing.head, { autoAlpha: 0 }, 0.5)
      .set(incoming.head, { autoAlpha: 1 }, 0.5)
      .fromTo(
        incoming.eye,
        { autoAlpha: 0, y: 6 },
        { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out" },
        0.55,
      )
      .fromTo(
        incoming.t1,
        { clipPath: HIDE_1 },
        { clipPath: SHOW, duration: 0.7, ease: "power3.out" },
        0.55,
      )
      .fromTo(
        incoming.t2,
        { clipPath: HIDE_2 },
        { clipPath: SHOW, duration: 0.7, ease: "power3.out" },
        0.62,
      )
      .to(outgoing.body, {
        autoAlpha: 0,
        y: -6,
        duration: 0.3,
        ease: "power1.in",
      }, 0.05)
      .set(incoming.body, { autoAlpha: 1, y: 0 }, 0.4);

    if (incoming.body) {
      timeline.fromTo(
        Array.from(incoming.body.children),
        { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.06, ease: "power2.out" },
        0.4,
      );
    }

    const arcState = {
      a0: Number(arcRef.current?.dataset.a0 ?? rest[0]),
      a1: Number(arcRef.current?.dataset.a1 ?? rest[1]),
    };

    timeline
      .to(
        arcState,
        {
          a0: ARC_SWEEP[0],
          a1: ARC_SWEEP[1],
          duration: 0.6,
          ease: "power2.inOut",
          onUpdate: () => setArc(arcState.a0, arcState.a1),
        },
        0,
      )
      .to(
        arcState,
        {
          a0: rest[0],
          a1: rest[1],
          duration: 0.85,
          ease: "power3.out",
          onUpdate: () => setArc(arcState.a0, arcState.a1),
        },
        0.6,
      );

    if (arcRef.current) {
      timeline.to(
        arcRef.current,
        { fill: tint, duration: 1.1, ease: "power1.inOut" },
        0.1,
      );
    }

    shownRef.current = to;
  }, [count, index]);

  useLayoutEffect(() => {
    return () => {
      timelineRef.current?.kill();
    };
  }, []);

  if (!record) {
    return null;
  }

  const start = stripStart(safeIndex, count, VISIBLE);
  const select = (next: number, direction: 1 | -1) => {
    if (count < 2) return;
    const wrapped = wrapIndex(next, count);

    if (wrapped === safeIndex) return;

    directionRef.current = direction;
    setRatingMessage(null);
    setIndex(wrapped);
  };

  const step = (direction: 1 | -1) => {
    select(safeIndex + direction, direction);
  };

  const go = (next: number) => {
    select(next, stepDirection(safeIndex, next, count));
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (
      (event.target as HTMLElement).closest(
        "button, a, input, select, textarea",
      )
    ) {
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    }
  };

  const handlePointerDown = (event: ReactPointerEvent) => {
    swipeRef.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: ReactPointerEvent) => {
    const swipe = swipeRef.current;
    swipeRef.current = null;

    if (!swipe) return;

    const deltaX = event.clientX - swipe.x;
    const deltaY = event.clientY - swipe.y;

    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
      step(deltaX < 0 ? 1 : -1);
    }
  };

  const handleRate = async (nextRating: number | null) => {
    if (!onRate || pendingRating) return;

    const previous = ratingOverrides[record.id];
    setRatingOverrides((current) => ({
      ...current,
      [record.id]: nextRating,
    }));
    setPendingRating(true);
    setRatingMessage(null);

    try {
      await onRate(record, nextRating);
      setRatingMessage(
        nextRating ? `Rated ${nextRating} out of 5.` : "Rating cleared.",
      );
    } catch {
      setRatingOverrides((current) => {
        const next = { ...current };

        if (previous === undefined) {
          delete next[record.id];
        } else {
          next[record.id] = previous;
        }

        return next;
      });
      setRatingMessage("Rating could not be saved.");
    } finally {
      setPendingRating(false);
    }
  };

  return (
    <div className={cn("wax-frame", fill && "wax-frame-fill")}>
      <section
        ref={rootRef}
        className={cn(
          "wax-root",
          fill && "wax-fill",
          flush && "wax-flush",
          className,
        )}
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured vinyls"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <style>{CSS}</style>

      <div className="wax-canvas">
        <svg className="wax-arc" viewBox="0 0 960 520" aria-hidden="true">
          <path ref={arcRef} style={{ opacity: 0.34 }} />
        </svg>

        <div className="wax-top">
          <Link
            href="/app?view=collection#shelving"
            className="wax-btn"
            aria-label="Open shelving"
          >
            <Archive className="wax-ico" aria-hidden="true" />
          </Link>
          <a
            href={discogsUrl(record)}
            className="wax-btn"
            aria-label="Open this record on Discogs"
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="wax-ico" aria-hidden="true" />
          </a>
        </div>

        <div className="wax-pager" role="tablist" aria-label="Choose a vinyl">
          {records.map((candidate, position) => (
            <button
              key={candidate.id}
              type="button"
              role="tab"
              className="wax-btn wax-dot"
              aria-selected={position === safeIndex}
              aria-current={position === safeIndex ? "true" : undefined}
              aria-label={`${candidate.artist} ${displayAlbumTitle(candidate)}`}
              onClick={() => go(position)}
            >
              <i />
            </button>
          ))}
        </div>

        <div
          className="wax-plates"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            swipeRef.current = null;
          }}
        >
          {records.map((candidate, position) => (
            <div
              key={candidate.id}
              ref={(element) => {
                orbitRefs.current[position] = element;
              }}
              className="wax-orbit"
              aria-hidden={position !== safeIndex}
            >
              <VinylArtwork
                record={candidate}
                accent={ACCENTS[position % ACCENTS.length]}
              />
            </div>
          ))}
        </div>

        <div className="wax-head" aria-live="polite">
          {records.map((candidate, position) => {
            const candidateTitle = displayAlbumTitle(candidate);
            const candidateReasons = reasons?.[candidate.id] ?? [];

            return (
              <div
                key={candidate.id}
                ref={(element) => {
                  headRefs.current[position] = element;
                }}
                className="wax-hd"
                aria-hidden={position !== safeIndex}
              >
                <p className="wax-eye">
                  {featuredLabel(candidate, candidateReasons)}
                </p>
                <h2 style={{ margin: 0, font: "inherit" }}>
                  <span
                    className="wax-t1"
                    style={{
                      fontSize: `${fitSize(candidate.artist.length, 48, 282, 0.66)}px`,
                    }}
                  >
                    {candidate.artist}
                  </span>
                  <span
                    className="wax-t2"
                    style={{
                      fontSize: `${fitSize(candidateTitle.length, 54, 288, 0.68)}px`,
                    }}
                  >
                    {candidateTitle}
                  </span>
                </h2>
              </div>
            );
          })}
        </div>

        <div className="wax-acts">
          <a
            className="wax-btn"
            href={discogsUrl(record)}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="wax-ico" aria-hidden="true" />
            Open Discogs
          </a>
          <Link className="wax-btn" href="/app?view=collection#shelving">
            <Disc3 className="wax-ico" aria-hidden="true" />
            View shelving
          </Link>
        </div>

        <div className="wax-card">
          <div className="wax-tabs" role="tablist" aria-label="Vinyl details">
            {(["details", "formats"] as const).map((candidateTab) => (
              <button
                key={candidateTab}
                type="button"
                role="tab"
                className="wax-btn wax-tab"
                aria-selected={tab === candidateTab}
                onClick={() => setTab(candidateTab)}
              >
                {candidateTab === "details" ? "Details" : "Formats"}
              </button>
            ))}
          </div>

          <div className="wax-bodies">
            {records.map((candidate, position) => {
              const candidateTitle = displayAlbumTitle(candidate);
              const candidateReasons = reasons?.[candidate.id] ?? [];
              const candidateAccent = ACCENTS[position % ACCENTS.length];
              const candidateDescription =
                candidate.notes?.trim() ||
                featuredDescription(
                  candidate,
                  candidateReasons,
                  candidateTitle,
                );
              const candidateRating =
                ratingOverrides[candidate.id] ?? candidate.rating ?? null;

              return (
                <div
                  key={candidate.id}
                  ref={(element) => {
                    bodyRefs.current[position] = element;
                  }}
                  className="wax-body"
                  aria-hidden={position !== safeIndex}
                >
                  <div className="wax-rate">
                    <div
                      className="wax-badge"
                      style={{
                        background: candidateAccent.background,
                        color: candidateAccent.foreground,
                      }}
                    >
                      <span
                        className="wax-num"
                        aria-label={
                          candidateRating
                            ? `Rated ${candidateRating} out of 5`
                            : "Unrated"
                        }
                      >
                        {candidateRating ? candidateRating.toFixed(1) : "—"}
                      </span>
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="m12 2.5 2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.2l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
                      </svg>
                    </div>
                  </div>

                  <p className="wax-chef">{candidate.artist}</p>
                  <p className="wax-kit">
                    {[candidate.year, candidate.label]
                      .filter(Boolean)
                      .join(" · ") || "Label not recorded"}
                  </p>

                  {tab === "details" ? (
                    <p className="wax-desc">{candidateDescription}</p>
                  ) : candidate.format.length > 0 ? (
                    <ul className="wax-formats">
                      {candidate.format.map((format) => (
                        <li key={format}>{format}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="wax-desc">
                      No format recorded for this pressing.
                    </p>
                  )}

                  <div className="wax-rate-control">
                    <div className="wax-rate-meta">
                      <p className="wax-rate-label">Your rating</p>
                      <span className="wax-status">
                        <i />
                        {candidate.status === "owned" ? "Owned" : "Wantlist"}
                      </span>
                    </div>
                    <StarRating
                      value={candidateRating}
                      onChange={
                        onRate && position === safeIndex
                          ? handleRate
                          : undefined
                      }
                      disabled={!onRate || pendingRating}
                      label={`Rate ${candidate.artist} ${candidateTitle}`}
                      size="sm"
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-end">
                    <RecordQuickActions record={candidate} />
                  </div>

                  <p className="wax-rate-msg" aria-live="polite">
                    {position === safeIndex ? ratingMessage : ""}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="wax-strip">
          <button
            type="button"
            className="wax-btn wax-arrow"
            aria-label="Previous vinyl"
            onClick={() => step(-1)}
          >
            <svg viewBox="0 0 12 16" aria-hidden="true">
              <path d="M11 0v16L0 8z" />
            </svg>
          </button>
          <div className="wax-win">
            <div
              className="wax-track"
              style={{ transform: `translateX(${-start * ITEM}px)` }}
            >
              {records.map((candidate, position) => (
                <div key={candidate.id} className="wax-th">
                  <button
                    type="button"
                    className="wax-btn"
                    aria-current={position === safeIndex ? "true" : undefined}
                    onClick={() => go(position)}
                  >
                    <VinylArtwork
                      record={candidate}
                      accent={ACCENTS[position % ACCENTS.length]}
                      mini
                    />
                    <span>
                      {candidate.artist} · {displayAlbumTitle(candidate)}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="wax-btn wax-arrow"
            aria-label="Next vinyl"
            onClick={() => step(1)}
          >
            <svg viewBox="0 0 12 16" aria-hidden="true">
              <path d="M1 0v16l11-8z" />
            </svg>
          </button>
        </div>

        <div className="wax-mobile-nav">
          <button
            type="button"
            className="wax-btn"
            aria-label="Previous vinyl"
            onClick={() => step(-1)}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </button>
          <span>
            {safeIndex + 1} / {count}
          </span>
          <button
            type="button"
            className="wax-btn"
            aria-label="Next vinyl"
            onClick={() => step(1)}
          >
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

        <p className="wax-sr" aria-live="polite">
          {record
            ? `Vinyl ${safeIndex + 1} of ${count}: ${record.artist}, ${albumTitle}, ${featuredLabel(
                record,
                effectiveReasons,
              ).toLowerCase()}${
                effectiveRating ? `, rated ${effectiveRating} out of 5` : ""
              }`
            : ""}
        </p>
      </section>
    </div>
  );
}
