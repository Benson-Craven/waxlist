import { describe, expect, test } from "vitest";

import {
  normalizeYouTubeLinkEntries,
  parseYouTubeVideoUrl,
} from "@/lib/listening/youtube/normalize";

describe("YouTube link normalization", () => {
  test.each([
    [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "dQw4w9WgXcQ",
    ],
    ["https://youtu.be/dQw4w9WgXcQ?t=42", "dQw4w9WgXcQ"],
    [
      "https://youtube.com/shorts/dQw4w9WgXcQ?feature=share",
      "dQw4w9WgXcQ",
    ],
  ])("canonicalizes an individual video URL", (input, videoId) => {
    expect(parseYouTubeVideoUrl(input)).toEqual({
      ok: true,
      videoId,
      canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    });
  });

  test("deduplicates video ids while preserving user-supplied metadata", () => {
    const result = normalizeYouTubeLinkEntries({
      entries: [
        {
          url: "https://youtu.be/dQw4w9WgXcQ",
          artist: "",
          album: "",
          note: "",
          metadataConfirmed: false,
        },
        {
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          artist: "Rick Astley",
          album: "Whenever You Need Somebody",
          note: "Record-shop lead",
          metadataConfirmed: true,
        },
      ],
      now: new Date("2026-07-24T10:00:00.000Z"),
    });

    expect(result.issues).toEqual([]);
    expect(result.snapshot.evidenceReviewed).toBe(1);
    expect(result.snapshot.candidates).toHaveLength(1);
    expect(result.snapshot.candidates[0]).toMatchObject({
      id: "youtube:dQw4w9WgXcQ",
      provider: "youtube",
      artist: "Rick Astley",
      album: "Whenever You Need Somebody",
      evidenceCount: 1,
      metadataQuality: "complete",
      sourceIdentifiers: {
        youtubeVideoIds: ["dQw4w9WgXcQ"],
        sourceUrls: [
          "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        ],
      },
      sourceEvidence: [
        {
          type: "youtube_link",
          label: "YouTube link",
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          note: "Record-shop lead",
        },
      ],
    });
    expect(JSON.stringify(result.snapshot)).not.toContain("watched");
    expect(JSON.stringify(result.snapshot)).not.toContain("listened");
  });

  test("keeps metadata incomplete until the user confirms artist and album", () => {
    const result = normalizeYouTubeLinkEntries({
      entries: [
        {
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          artist: "Rick Astley",
          album: "Whenever You Need Somebody",
          metadataConfirmed: false,
        },
      ],
    });

    expect(result.snapshot.candidates[0]).toMatchObject({
      metadataQuality: "review",
      reviewReason: "Confirm the artist and album before catalogue matching.",
    });
  });

  test("does not treat merged, unconfirmed duplicate metadata as confirmed", () => {
    const result = normalizeYouTubeLinkEntries({
      entries: [
        {
          url: "https://youtu.be/dQw4w9WgXcQ",
          artist: "Rick Astley",
          metadataConfirmed: true,
        },
        {
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          album: "Whenever You Need Somebody",
          metadataConfirmed: false,
        },
      ],
    });

    expect(result.snapshot.candidates[0]).toMatchObject({
      artist: "Rick Astley",
      album: "Whenever You Need Somebody",
      metadataQuality: "review",
      reviewReason: "Confirm the artist and album before catalogue matching.",
    });
  });

  test("retains confirmed metadata when a later duplicate is unconfirmed", () => {
    const result = normalizeYouTubeLinkEntries({
      entries: [
        {
          url: "https://youtu.be/dQw4w9WgXcQ",
          artist: "Rick Astley",
          album: "Whenever You Need Somebody",
          metadataConfirmed: true,
        },
        {
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          artist: "Unconfirmed artist",
          album: "Unconfirmed album",
          note: "Latest note",
          metadataConfirmed: false,
        },
      ],
    });

    expect(result.snapshot.candidates[0]).toMatchObject({
      artist: "Rick Astley",
      album: "Whenever You Need Somebody",
      metadataQuality: "complete",
      sourceEvidence: [
        {
          note: "Latest note",
        },
      ],
    });
  });

  test.each([
    ["https://example.com/watch?v=dQw4w9WgXcQ", "unsupported_host"],
    ["javascript:alert(1)", "unsupported_protocol"],
    ["not a URL", "malformed_url"],
    ["https://www.youtube.com/watch?v=short", "invalid_video_id"],
  ])("rejects invalid input without treating it as a video", (input, code) => {
    expect(parseYouTubeVideoUrl(input)).toMatchObject({
      ok: false,
      code,
    });
  });

  test.each([
    "https://www.youtube.com/playlist?list=PL123",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123",
    "https://youtu.be/dQw4w9WgXcQ?list=PL123",
  ])("returns explicit playlist guidance", (input) => {
    expect(parseYouTubeVideoUrl(input)).toEqual({
      ok: false,
      code: "playlist_unsupported",
      message: "Playlist import is coming later. Add individual video links.",
    });
  });

  test("retains hostile-looking metadata only as plain normalized text data", () => {
    const result = normalizeYouTubeLinkEntries({
      entries: [
        {
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          artist: "<img src=x onerror=alert(1)>",
          album: "<script>alert(1)</script>",
          note: "\"><svg onload=alert(1)>",
          metadataConfirmed: true,
        },
      ],
    });

    expect(result.snapshot.candidates[0]).toMatchObject({
      artist: "<img src=x onerror=alert(1)>",
      album: "<script>alert(1)</script>",
      sourceEvidence: [
        {
          note: "\"><svg onload=alert(1)>",
        },
      ],
    });
  });
});
