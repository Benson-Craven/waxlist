"use client";

import { useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

// Kept in step with the `.wax-collapse` transition in `app/globals.css`.
export const COLLAPSE_DURATION_MS = 240;

/**
 * An accordion body that folds open and shut instead of snapping between
 * states. The panel mounts at `0fr`, releases to `1fr` on the next frame, and
 * stays mounted while it closes so the exit reads as a collapse. It then
 * unmounts, so a closed group does not keep a record grid in the document.
 */
export function Collapse({
  id,
  open,
  children,
  className,
}: {
  id?: string;
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [isMounted, setIsMounted] = useState(open);
  const [isOpen, setIsOpen] = useState(open);

  // Derived during render, not in an effect, so a closed body starts at 0fr in
  // the same commit that mounts it.
  if (open && !isMounted) {
    setIsMounted(true);
  }

  if (!open && isOpen) {
    setIsOpen(false);
  }

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    if (!open) {
      const timer = window.setTimeout(
        () => setIsMounted(false),
        COLLAPSE_DURATION_MS,
      );

      return () => window.clearTimeout(timer);
    }

    if (isOpen) {
      return;
    }

    // The body has to paint at 0fr for one frame before it can interpolate to
    // 1fr; releasing it in the same commit would skip the motion.
    let innerFrame = 0;
    const outerFrame = requestAnimationFrame(() => {
      innerFrame = requestAnimationFrame(() => setIsOpen(true));
    });

    return () => {
      cancelAnimationFrame(outerFrame);
      cancelAnimationFrame(innerFrame);
    };
  }, [isMounted, isOpen, open]);

  if (!isMounted) {
    return null;
  }

  return (
    <div
      id={id}
      data-state={isOpen ? "open" : "closed"}
      inert={isOpen ? undefined : true}
      className={cn("wax-collapse", className)}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
