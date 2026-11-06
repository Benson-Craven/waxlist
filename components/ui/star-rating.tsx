"use client";

import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

type StarRatingProps = {
  value: number | null;
  onChange?: (value: number | null) => void;
  disabled?: boolean;
  label: string;
  className?: string;
  size?: "sm" | "md";
};

const STARS = [1, 2, 3, 4, 5];

export function StarRating({
  value,
  onChange,
  disabled = false,
  label,
  className,
  size = "md",
}: StarRatingProps) {
  const isInteractive = Boolean(onChange) && !disabled;

  return (
    <div
      className={cn("flex items-center gap-1", className)}
      role="radiogroup"
      aria-label={label}
    >
      {STARS.map((star) => {
        const isFilled = typeof value === "number" && value >= star;

        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} out of 5`}
            disabled={!isInteractive}
            onClick={() => onChange?.(value === star ? null : star)}
            className={cn(
              "grid place-items-center rounded-full transition",
              size === "sm" ? "size-6" : "size-8",
              isInteractive
                ? "text-[#FFF4E8]/42 hover:bg-[#FFF4E8]/8 hover:text-[#F08A4B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F08A4B]/60"
                : "cursor-default text-[#FFF4E8]/42",
              isFilled && "text-[#F08A4B]",
            )}
          >
            <Star
              className={cn(
                size === "sm" ? "size-3.5" : "size-4",
                isFilled && "fill-current",
              )}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}
