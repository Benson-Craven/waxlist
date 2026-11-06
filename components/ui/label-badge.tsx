import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Neutral record-state label. The tone never introduces a hue: state is carried
 * by the text and icon, and the cream opacity only sets how loud the label is.
 * Use this for owned/wanted chips, filters, counts, severities, and statuses so
 * every badge in the workspace reads as one system.
 */
const labelBadgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full",
  {
    variants: {
      tone: {
        neutral: "bg-[#FFF4E8]/8 text-[#FFF4E8]/66",
        quiet: "bg-[#FFF4E8]/5 text-[#FFF4E8]/56",
        attention: "bg-[#FFF4E8]/16 text-[#FFF4E8]/92",
        outline: "border border-[#FFF4E8]/12 text-[#FFF4E8]/64",
      },
      size: {
        xs: "px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.12em]",
        sm: "px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]",
        md: "px-2.5 py-1 text-xs font-medium",
        lg: "px-3 py-1.5 text-xs font-medium",
      },
    },
    defaultVariants: {
      tone: "neutral",
      size: "md",
    },
  },
);

function LabelBadge({
  className,
  tone,
  size,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof labelBadgeVariants>) {
  return (
    <span
      data-slot="label-badge"
      className={cn(labelBadgeVariants({ tone, size }), className)}
      {...props}
    />
  );
}

export { LabelBadge, labelBadgeVariants };
