"use client";

import { useSyncExternalStore } from "react";

type PanelPreferenceStore = {
  subscribe: (onStoreChange: () => void) => () => void;
  getSnapshot: () => boolean;
  getServerSnapshot: () => boolean;
  write: (hidden: boolean) => void;
};

const stores = new Map<string, PanelPreferenceStore>();

function createPanelPreferenceStore(
  storageKey: string,
  changeEvent: string,
): PanelPreferenceStore {
  // Used when storage is unavailable, and cleared when another tab changes the
  // preference so the storage event becomes the source of truth again.
  let override: boolean | null = null;

  function getSnapshot() {
    if (typeof window === "undefined") {
      return false;
    }

    if (override !== null) {
      return override;
    }

    try {
      return window.localStorage.getItem(storageKey) === "true";
    } catch {
      return false;
    }
  }

  function subscribe(onStoreChange: () => void) {
    function handleStorage(event: StorageEvent) {
      if (event.key !== null && event.key !== storageKey) {
        return;
      }

      override = null;
      onStoreChange();
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener(changeEvent, onStoreChange);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(changeEvent, onStoreChange);
    };
  }

  function write(hidden: boolean) {
    override = hidden;

    try {
      window.localStorage.setItem(storageKey, String(hidden));
    } catch {
      // Storage can be blocked; the override keeps the toggle working for this
      // tab.
    }

    window.dispatchEvent(new Event(changeEvent));
  }

  return {
    subscribe,
    getSnapshot,
    getServerSnapshot: () => false,
    write,
  };
}

function getPanelPreferenceStore(
  storageKey: string,
  changeEvent: string,
): PanelPreferenceStore {
  const existing = stores.get(storageKey);

  if (existing) {
    return existing;
  }

  const store = createPanelPreferenceStore(storageKey, changeEvent);
  stores.set(storageKey, store);

  return store;
}

/**
 * Reads and writes one persisted panel-visibility preference. The preference
 * is shared across tabs through the `storage` event and stays usable when
 * browser storage is blocked.
 */
export function usePanelHiddenPreference(
  storageKey: string,
  changeEvent: string,
) {
  const store = getPanelPreferenceStore(storageKey, changeEvent);
  const hidden = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  return [hidden, store.write] as const;
}
