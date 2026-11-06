"use client";

import type { FormEvent } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

type GlobalWorkspaceSearchProps = {
  query: string;
  onQueryChange: (query: string) => void;
  onSubmit: (query: string) => void;
};

export function GlobalWorkspaceSearch({
  query,
  onQueryChange,
  onSubmit,
}: GlobalWorkspaceSearchProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(query.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="relative w-full xl:max-w-xl">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#FFF4E8]/38"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search collection, wantlist, barcode, catalog"
        className="h-11 rounded-full border-[#FFF4E8]/14 bg-[#FFF4E8]/8 pl-10 pr-4 text-[#FFF4E8] placeholder:text-[#FFF4E8]/36 focus-visible:border-[#FFF4E8]/30 focus-visible:ring-[#FFF4E8]/12"
        aria-label="Search collection, wantlist, barcode, catalog"
      />
    </form>
  );
}
