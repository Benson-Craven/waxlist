#!/usr/bin/env node
/**
 * Upgrades stored Discogs artwork from the 150px thumbnail rendition to the
 * 600px release rendition.
 *
 * The Discogs CDN signs each rendition, so an existing thumbnail URL cannot be
 * resized by rewriting its path. This script re-reads the release payload and
 * stores the large `images[].resource_url` instead.
 *
 *   node scripts/backfill-discogs-artwork.mjs              # dry run
 *   node scripts/backfill-discogs-artwork.mjs --apply      # write changes
 *   node scripts/backfill-discogs-artwork.mjs --limit=5    # cap API calls
 *   node scripts/backfill-discogs-artwork.mjs --release=35887522
 *
 * Dry run is the default. Requires DATABASE_URL, DISCOGS_TOKEN and
 * DISCOGS_USER_AGENT in .env.local (or the process environment).
 */
import nextEnv from "@next/env";
import postgres from "postgres";

import {
  discogsArtworkQuality,
  isDiscogsThumbnailUrl,
  pickDiscogsArtworkUrl,
} from "../lib/discogs/artwork.ts";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const DISCOGS_API_ROOT = "https://api.discogs.com";
const DEFAULT_DELAY_MS = 1100;

function readFlagValue(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((argument) => argument.startsWith(prefix));

  return match ? match.slice(prefix.length) : null;
}

const apply = process.argv.includes("--apply");
const limit = Number.parseInt(readFlagValue("limit") ?? "", 10);
const onlyReleaseId = Number.parseInt(readFlagValue("release") ?? "", 10);
const delayMs =
  Number.parseInt(readFlagValue("delay") ?? "", 10) ||
  Number.parseInt(process.env.DISCOGS_REQUEST_DELAY_MS ?? "", 10) ||
  DEFAULT_DELAY_MS;

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL?.trim();
const token = process.env.DISCOGS_TOKEN?.trim();
const userAgent = process.env.DISCOGS_USER_AGENT?.trim();

if (!databaseUrl) fail("DATABASE_URL is required.");
if (!token) fail("DISCOGS_TOKEN is required.");
if (!userAgent) fail("DISCOGS_USER_AGENT is required.");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchReleaseArtwork(releaseId) {
  const response = await fetch(`${DISCOGS_API_ROOT}/releases/${releaseId}`, {
    headers: {
      Authorization: `Discogs token=${token}`,
      "User-Agent": userAgent,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const remaining = Number.parseInt(
    response.headers.get("x-discogs-ratelimit-remaining") ?? "",
    10,
  );

  if (response.status === 429) {
    return { rateLimited: true, remaining, url: null, error: "rate limited" };
  }

  if (!response.ok) {
    return {
      rateLimited: false,
      remaining,
      url: null,
      error: `Discogs returned HTTP ${response.status}`,
    };
  }

  const payload = await response.json();
  const url = pickDiscogsArtworkUrl(payload.images, payload.thumb);

  return { rateLimited: false, remaining, url, error: null };
}

async function assetExists(url) {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": userAgent },
      cache: "no-store",
    });
    const contentType = response.headers.get("content-type") ?? "";

    return response.ok && contentType.startsWith("image/");
  } catch {
    return false;
  }
}

const sql = postgres(databaseUrl, { prepare: false, max: 1 });

try {
  const collectionRows = await sql`
    select id, discogs_release_id, image_url, artist, title
    from collection_items
    where image_url is not null
  `;
  const wishlistRows = await sql`
    select id, record_payload
    from wishlist_items
  `;

  const targets = new Map();

  function addTarget(releaseId, target) {
    if (!Number.isInteger(releaseId) || releaseId <= 0) return;
    if (!targets.has(releaseId)) {
      targets.set(releaseId, { collectionIds: [], wishlistIds: [], samples: [] });
    }

    const entry = targets.get(releaseId);

    if (target.kind === "collection") {
      entry.collectionIds.push(target.id);
      if (entry.samples.length < 3) {
        entry.samples.push(`${target.artist} - ${target.title}`);
      }
    } else {
      entry.wishlistIds.push(target.id);
    }
  }

  for (const row of collectionRows) {
    if (isDiscogsThumbnailUrl(row.image_url)) {
      addTarget(row.discogs_release_id, {
        kind: "collection",
        id: row.id,
        artist: row.artist,
        title: row.title,
      });
    }
  }

  for (const row of wishlistRows) {
    const payload = row.record_payload;

    if (!payload || typeof payload !== "object") continue;
    if (!isDiscogsThumbnailUrl(payload.thumb)) continue;

    addTarget(payload.discogsReleaseId, { kind: "wishlist", id: row.id });
  }

  let selected = [...targets.entries()];

  if (Number.isInteger(onlyReleaseId) && onlyReleaseId > 0) {
    selected = selected.filter(([releaseId]) => releaseId === onlyReleaseId);
  }

  if (Number.isInteger(limit) && limit > 0) {
    selected = selected.slice(0, limit);
  }

  console.log(
    `\n${apply ? "APPLY" : "DRY RUN"} · ${selected.length} release(s) with thumbnail artwork\n`,
  );

  let updatedCollection = 0;
  let updatedWishlist = 0;
  let skipped = 0;
  let failed = 0;

  for (const [index, [releaseId, entry]] of selected.entries()) {
    if (index > 0) await sleep(delayMs);

    const result = await fetchReleaseArtwork(releaseId);

    if (result.rateLimited) {
      console.error(
        `Release ${releaseId}: rate limited by Discogs. Stopping; re-run later to continue.`,
      );
      break;
    }

    if (!result.url) {
      failed += 1;
      console.error(`Release ${releaseId}: ${result.error ?? "no artwork"}`);
      continue;
    }

    if (isDiscogsThumbnailUrl(result.url)) {
      skipped += 1;
      console.log(`Release ${releaseId}: only a thumbnail is available, skipped`);
      continue;
    }

    if (!(await assetExists(result.url))) {
      failed += 1;
      console.error(`Release ${releaseId}: large rendition did not respond`);
      continue;
    }

    const quality = discogsArtworkQuality(result.url);
    console.log(
      `Release ${releaseId}: thumbnail -> ${quality} · collection ${entry.collectionIds.length}, wishlist ${entry.wishlistIds.length}`,
    );

    if (!apply) continue;

    if (entry.collectionIds.length > 0) {
      const updated = await sql`
        update collection_items
        set image_url = ${result.url}
        where id in ${sql(entry.collectionIds)}
        returning id
      `;
      updatedCollection += updated.length;
    }

    if (entry.wishlistIds.length > 0) {
      const updated = await sql`
        update wishlist_items
        set record_payload = jsonb_set(record_payload, '{thumb}', to_jsonb(${result.url}::text))
        where id in ${sql(entry.wishlistIds)}
        returning id
      `;
      updatedWishlist += updated.length;
    }
  }

  console.log(
    `\nSummary: ${updatedCollection} collection row(s), ${updatedWishlist} wishlist row(s) updated, ${skipped} skipped, ${failed} failed.\n`,
  );

  if (!apply && selected.length > 0) {
    console.log("Re-run with --apply to write these changes.\n");
  }
} finally {
  await sql.end({ timeout: 5 });
}
