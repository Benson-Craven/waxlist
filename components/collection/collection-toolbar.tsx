"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Filter, ListFilter, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Collapse } from "@/components/ui/collapse";
import {
  COLLECTION_RATING_FILTERS,
  COLLECTION_SORTS,
  COLLECTION_TABS,
  type CollectionFilters,
  type CollectionSort,
  type CollectionTab,
} from "@/lib/collection/browse";
import { cn } from "@/lib/utils";

type CollectionToolbarProps = {
  tab: CollectionTab;
  tabCounts: Record<CollectionTab, number>;
  onTabChange: (tab: CollectionTab) => void;
  sort: CollectionSort;
  onSortChange: (sort: CollectionSort) => void;
  filters: CollectionFilters;
  formatOptions: Array<{ id: string; label: string; count: number }>;
  onFiltersChange: (filters: CollectionFilters) => void;
  onReset: () => void;
  activeFilterCount: number;
  visibleCount: number;
  totalCount: number;
  actions?: ReactNode;
};

function FilterChip({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
        active
          ? "bg-[#FFF4E8] text-[#08030f]"
          : "bg-[#FFF4E8]/7 text-[#FFF4E8]/64 hover:bg-[#FFF4E8]/12 hover:text-[#FFF4E8]",
      )}
    >
      {children}
      {typeof count === "number" ? (
        <span
          className={cn(
            "text-[0.65rem] tabular-nums",
            active ? "text-[#08030f]/55" : "text-[#FFF4E8]/34",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function CollectionToolbar({
  tab,
  tabCounts,
  onTabChange,
  sort,
  onSortChange,
  filters,
  formatOptions,
  onFiltersChange,
  onReset,
  activeFilterCount,
  visibleCount,
  totalCount,
  actions,
}: CollectionToolbarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div
          role="group"
          aria-label="Collection status"
          className="flex flex-wrap gap-x-7 gap-y-1"
        >
          {COLLECTION_TABS.map((item) => {
            const isActive = tab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "relative min-w-max pb-2.5 text-sm font-medium transition",
                  isActive
                    ? "text-[#FFF4E8]"
                    : "text-[#FFF4E8]/50 hover:text-[#FFF4E8]/78",
                )}
              >
                {item.label}
                <span className="ml-2 text-xs text-[#FFF4E8]/36">
                  {tabCounts[item.id]}
                </span>
                {isActive ? (
                  <span className="absolute inset-x-0 bottom-0 h-px bg-[#FFF4E8]" />
                ) : null}
              </button>
            );
          })}
        </div>

        {actions ? (
          <div className="flex flex-wrap gap-2 pb-1">{actions}</div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          aria-expanded={filtersOpen}
          aria-controls="collection-filters"
          onClick={() => setFiltersOpen((current) => !current)}
          className={cn(
            "rounded-full border-transparent px-4",
            filtersOpen
              ? "bg-[#FFF4E8]/12 text-[#FFF4E8]"
              : "bg-[#1b1b20] text-[#FFF4E8]/72 hover:bg-[#24242a] hover:text-[#FFF4E8]",
          )}
        >
          <Filter className="size-4" aria-hidden="true" />
          Filters
          {activeFilterCount > 0 ? (
            <span className="text-[#FFF4E8]/48">({activeFilterCount})</span>
          ) : null}
        </Button>

        <div className="relative">
          <ListFilter
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#FFF4E8]/46"
            aria-hidden="true"
          />
          <select
            aria-label="Sort collection"
            value={sort}
            onChange={(event) => onSortChange(event.target.value as CollectionSort)}
            className="h-8 cursor-pointer appearance-none rounded-full border border-transparent bg-[#1b1b20] pl-9 pr-8 text-sm font-medium text-[#FFF4E8]/78 transition hover:bg-[#24242a] hover:text-[#FFF4E8] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#FFF4E8]/30"
          >
            {COLLECTION_SORTS.map((option) => (
              <option key={option.id} value={option.id} className="bg-[#101014]">
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#FFF4E8]/46"
            aria-hidden="true"
          />
        </div>

        {activeFilterCount > 0 ? (
          <Button
            type="button"
            variant="outline"
            onClick={onReset}
            className="rounded-full border-transparent bg-transparent px-3 text-[#FFF4E8]/58 hover:bg-[#FFF4E8]/8 hover:text-[#FFF4E8]"
          >
            <X className="size-4" aria-hidden="true" />
            Reset
          </Button>
        ) : null}

        <p
          className="ml-auto text-xs tabular-nums text-[#FFF4E8]/42"
          aria-live="polite"
        >
          {visibleCount.toLocaleString()} of {totalCount.toLocaleString()}{" "}
          records
        </p>
      </div>

      <Collapse open={filtersOpen} id="collection-filters">
        <div className="mt-3 flex flex-col gap-3 rounded-2xl bg-[#FFF4E8]/5 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-14 text-xs uppercase tracking-[0.16em] text-[#FFF4E8]/36">
              Rating
            </span>
            {COLLECTION_RATING_FILTERS.map((option) => (
              <FilterChip
                key={option.id}
                active={filters.rating === option.id}
                onClick={() =>
                  onFiltersChange({ ...filters, rating: option.id })
                }
              >
                {option.label}
              </FilterChip>
            ))}
          </div>

          {formatOptions.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-14 text-xs uppercase tracking-[0.16em] text-[#FFF4E8]/36">
                Format
              </span>
              <FilterChip
                active={filters.format === null}
                onClick={() => onFiltersChange({ ...filters, format: null })}
              >
                Any
              </FilterChip>
              {formatOptions.map((option) => (
                <FilterChip
                  key={option.id}
                  active={filters.format === option.id}
                  count={option.count}
                  onClick={() =>
                    onFiltersChange({
                      ...filters,
                      format: filters.format === option.id ? null : option.id,
                    })
                  }
                >
                  {option.label}
                </FilterChip>
              ))}
            </div>
          ) : null}
        </div>
      </Collapse>
    </div>
  );
}
