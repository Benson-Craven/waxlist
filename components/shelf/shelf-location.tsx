import { MapPin } from "lucide-react";

import {
  describeShelfLocation,
  type CollectionLocation,
} from "@/lib/collection/location";
import { cn } from "@/lib/utils";

/**
 * The one way WAXLIST renders a shelf location: group-led for a placed record,
 * `Unsorted` for a record that cannot be walked to.
 */
export function ShelfLocationSummary({
  location,
  variant = "inline",
  className,
}: {
  location: CollectionLocation;
  variant?: "inline" | "plate";
  className?: string;
}) {
  const { isPlaced, group, code, label } = describeShelfLocation(location);

  if (variant === "plate") {
    return (
      <div
        className={cn(
          "flex items-baseline justify-between gap-3",
          className,
        )}
      >
        <span
          className={cn(
            "min-w-0 truncate font-serif text-lg italic leading-none",
            isPlaced ? "text-[#FFF4E8]" : "text-[#FFD4B5]",
          )}
        >
          {isPlaced ? group : label}
        </span>
        {isPlaced ? (
          <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-[#FFF4E8]/42">
            {code || "Group only"}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex max-w-full min-w-0 items-center gap-1.5",
        !isPlaced && "text-[#FFD4B5]/85",
        className,
      )}
    >
      <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  );
}
