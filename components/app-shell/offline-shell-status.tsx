"use client";

import { useEffect, useState } from "react";
import { RefreshCw, WifiOff } from "lucide-react";

const COLLECTION_CACHE_KEY = "waxlist:digging:collection:v2";

function readCachedRecordCount() {
  try {
    const raw = window.localStorage.getItem(COLLECTION_CACHE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;

    return Array.isArray(parsed) ? parsed.length : null;
  } catch {
    return null;
  }
}

export function OfflineShellStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [cachedRecords, setCachedRecords] = useState<number | null>(null);

  useEffect(() => {
    function syncConnection() {
      setIsOnline(navigator.onLine);
      setCachedRecords(readCachedRecordCount());
    }

    syncConnection();

    window.addEventListener("online", syncConnection);
    window.addEventListener("offline", syncConnection);

    return () => {
      window.removeEventListener("online", syncConnection);
      window.removeEventListener("offline", syncConnection);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const mode = process.env.NODE_ENV === "production" ? "prod" : "dev";
    const register = () => {
      navigator.serviceWorker
        .register(`/sw.js?mode=${mode}`, { scope: "/" })
        .catch(() => {
          // Offline support is an enhancement; the app still works online.
        });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register, { once: true });

    return () => {
      window.removeEventListener("load", register);
    };
  }, []);

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-[#F08A4B]/30 bg-[#1A0F08]/95 px-4 py-3 text-[#FFF4E8] shadow-[0_-18px_50px_rgba(0,0,0,0.45)] backdrop-blur"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <WifiOff
            className="mt-0.5 size-4 shrink-0 text-[#F08A4B]"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium">Offline</p>
            <p className="mt-1 text-xs leading-5 text-[#FFF4E8]/62">
              {cachedRecords === null
                ? "Your last shelf stays available. Digging still works."
                : `Showing the collection cached on this device, ${cachedRecords.toLocaleString()} ${
                    cachedRecords === 1 ? "record" : "records"
                  }. Digging still searches that cache.`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex h-9 w-fit shrink-0 items-center gap-2 rounded-full border border-[#FFF4E8]/16 bg-[#FFF4E8]/8 px-4 text-xs font-medium text-[#FFF4E8] transition hover:bg-[#FFF4E8]/14"
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Retry
        </button>
      </div>
    </div>
  );
}
