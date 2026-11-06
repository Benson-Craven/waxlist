"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { PanelRight, X } from "lucide-react";

import { cn } from "@/lib/utils";

const DESKTOP_QUERY = "(min-width: 1024px)";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);

    update();
    media.addEventListener("change", update);

    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}

/**
 * Right-edge side panel for the selected record. Desktop keeps the workspace
 * usable behind it so another record can be picked without closing the panel;
 * below that breakpoint it behaves as a modal drawer.
 */
export function InspectorSidePanel({
  id,
  open,
  labelledBy,
  onClose,
  children,
}: {
  id: string;
  open: boolean;
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const isModal = open && !isDesktop;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Focus and restore behaviour is tied to visibility only, so resizing the
  // window does not steal focus while the panel stays open.
  useEffect(() => {
    if (!open) {
      return;
    }

    const panel = panelRef.current;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    panel?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!isModal) {
      return;
    }

    const panel = panelRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function trapFocus(event: KeyboardEvent) {
      if (event.key !== "Tab" || !panel) {
        return;
      }

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => element.offsetParent !== null);

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", trapFocus);

    return () => {
      document.removeEventListener("keydown", trapFocus);
      document.body.style.overflow = previousOverflow;
    };
  }, [isModal]);

  return (
    <>
      {!isDesktop ? (
        <div
          aria-hidden="true"
          onClick={onClose}
          className={cn(
            "fixed inset-0 z-40 bg-[#05030A]/62 backdrop-blur-[2px] transition-opacity duration-300 motion-reduce:transition-none",
            open ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        />
      ) : null}
      <div
        id={id}
        ref={panelRef}
        role="dialog"
        aria-modal={isModal}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        inert={!open}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-[26rem] flex-col overflow-hidden bg-[linear-gradient(180deg,#140b1f_0%,#08030f_46%)] shadow-[-32px_0_80px_rgba(0,0,0,0.58)] outline-none transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-3 pt-5">
          <div className="flex items-center gap-2 text-[#FFF4E8]/52">
            <PanelRight className="size-4" aria-hidden="true" />
            <p className="text-xs uppercase tracking-[0.24em]">Inspector</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close inspector"
            title="Close inspector"
            className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#FFF4E8]/8 text-[#FFF4E8]/64 transition hover:bg-[#FFF4E8]/14 hover:text-[#FFF4E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF4E8]/60"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 pb-6 pt-2">
          {children}
        </div>
      </div>
    </>
  );
}
