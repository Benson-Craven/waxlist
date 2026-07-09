"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { WorkspaceViewId } from "@/lib/workspace/views";

type GlobalWorkspaceSearchProps = {
  activeView: WorkspaceViewId;
  initialQuery?: string;
};

export function GlobalWorkspaceSearch({
  activeView,
  initialQuery = "",
}: GlobalWorkspaceSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedQuery = query.trim();
    const targetView = activeView === "digging" ? "digging" : "collection";
    const params = new URLSearchParams({ view: targetView });

    if (trimmedQuery) {
      params.set("q", trimmedQuery);
    }

    router.push(`/app?${params.toString()}`);
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
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search collection, wantlist, barcode, catalog"
        className="h-11 rounded-full border-[#FFF4E8]/14 bg-[#FFF4E8]/8 pl-10 pr-4 text-[#FFF4E8] placeholder:text-[#FFF4E8]/36 focus-visible:border-[#FFF4E8]/30 focus-visible:ring-[#FFF4E8]/12"
        aria-label="Global collection search"
      />
    </form>
  );
}
