"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { Dialog } from "radix-ui";
import { Check, Loader2, Plus, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CollectionActionError,
  requestAssignCollectionGroup,
  type CollectionGroupAssignment,
} from "@/lib/collection/actions";
import type { CollectionRecord } from "@/lib/collection/record";
import { cn } from "@/lib/utils";

type GroupDialogRequest = {
  group: string;
  selectedIds: string[];
};

/**
 * One focused task: put records into a group. The group is the collection's
 * organisational bucket; unit, shelf, and slot stay on the record untouched so
 * the collector can refine the spot later from the inspector.
 *
 * A single record opens in quick mode: every existing group is one tap away and
 * saves immediately. The multi-record view is reserved for creating a group
 * from the unsorted pile or filling an existing group.
 */
export function GroupDialog({
  open,
  onOpenChange,
  request,
  records,
  groupNames,
  onAssigned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: GroupDialogRequest;
  records: CollectionRecord[];
  groupNames: string[];
  onAssigned: (updates: CollectionGroupAssignment[]) => void;
}) {
  const [group, setGroup] = useState(request.group);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(request.selectedIds),
  );
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingGroup, setPendingGroup] = useState<string | null>(null);
  const normalizedGroup = group.trim().toLowerCase();
  const isQuickAdd = request.selectedIds.length === 1 && !request.group;
  const quickRecord = useMemo(
    () =>
      isQuickAdd
        ? (records.find((record) => record.id === request.selectedIds[0]) ?? null)
        : null,
    [isQuickAdd, records, request.selectedIds],
  );
  const quickCurrentGroup = (quickRecord?.group ?? "").trim();
  const isQuickGroupCurrent =
    Boolean(quickCurrentGroup) &&
    quickCurrentGroup.toLowerCase() === normalizedGroup;
  const isExistingGroupName = groupNames.some(
    (name) => name.toLowerCase() === normalizedGroup,
  );
  const isBusy = isSaving || pendingGroup !== null;
  const availableRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return records
      .filter(
        (record) =>
          !normalizedGroup ||
          (record.group ?? "").trim().toLowerCase() !== normalizedGroup,
      )
      .filter((record) => {
        if (!normalizedQuery) {
          return true;
        }

        return [record.artist, record.title, record.group, record.label]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort(
        (left, right) =>
          left.artist.localeCompare(right.artist) ||
          left.title.localeCompare(right.title),
      );
  }, [normalizedGroup, query, records]);

  const availableIds = useMemo(
    () => new Set(availableRecords.map((record) => record.id)),
    [availableRecords],
  );
  const selectedAvailableCount = useMemo(
    () => [...selectedIds].filter((id) => availableIds.has(id)).length,
    [availableIds, selectedIds],
  );
  const allAvailableSelected =
    availableRecords.length > 0 &&
    selectedAvailableCount === availableRecords.length;
  const canSave = isQuickAdd
    ? Boolean(group.trim()) && !isQuickGroupCurrent && !isBusy
    : Boolean(group.trim()) && selectedAvailableCount > 0 && !isBusy;

  function toggleRecord(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
    setError(null);
  }

  function toggleAll() {
    setSelectedIds((current) => {
      const next = new Set(current);

      for (const record of availableRecords) {
        if (allAvailableSelected) {
          next.delete(record.id);
        } else {
          next.add(record.id);
        }
      }

      return next;
    });
    setError(null);
  }

  function readGroupError(caught: unknown, fallback: string) {
    return caught instanceof CollectionActionError ? caught.message : fallback;
  }

  /**
   * The quick path: one tap on a group files the selected record and closes the
   * dialog. No second confirmation, because moving a record between groups is
   * always reversible from the inspector.
   */
  async function assignQuickRecord(name: string) {
    if (!quickRecord || isBusy) {
      return;
    }

    const nextGroup = name.trim();

    if (!nextGroup) {
      setError("Name the group first.");
      return;
    }

    if (
      (quickRecord.group ?? "").trim().toLowerCase() === nextGroup.toLowerCase()
    ) {
      onOpenChange(false);
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("Grouping records needs a connection.");
      return;
    }

    setPendingGroup(nextGroup);
    setError(null);

    try {
      const updates = await requestAssignCollectionGroup(
        [quickRecord.id],
        nextGroup,
      );

      onAssigned(updates);
      onOpenChange(false);
    } catch (caught) {
      setError(readGroupError(caught, "The record could not be grouped."));
    } finally {
      setPendingGroup(null);
    }
  }

  async function save() {
    if (isQuickAdd) {
      await assignQuickRecord(group);
      return;
    }

    const ids = [...selectedIds].filter((id) => availableIds.has(id));

    if (!group.trim()) {
      setError("Name the group first.");
      return;
    }

    if (ids.length === 0) {
      setError("Choose at least one record.");
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("Grouping records needs a connection.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const updates = await requestAssignCollectionGroup(ids, group.trim());

      onAssigned(updates);
      onOpenChange(false);
    } catch (caught) {
      setError(readGroupError(caught, "The records could not be grouped."));
    } finally {
      setIsSaving(false);
    }
  }

  function handleGroupKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void save();
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-[#05030A]/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[61] flex max-h-[min(90vh,46rem)] w-[min(92vw,44rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[26px] bg-[#0C0714] p-6 text-[#FFF4E8] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.95)] sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Dialog.Title className="font-serif text-2xl italic leading-tight">
                Add to a group
              </Dialog.Title>
              <Dialog.Description className="mt-1.5 max-w-lg text-sm leading-6 text-[#FFF4E8]/52">
                {isQuickAdd
                  ? "Pick a group and the record is filed in one tap. The shelf spot stays as it is."
                  : "Name a group or start a new one, then choose its records. The shelf spot stays as it is."}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close add to group"
                className="grid size-9 shrink-0 place-items-center rounded-full text-[#FFF4E8]/52 transition hover:bg-[#FFF4E8]/10 hover:text-[#FFF4E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF4E8]/50"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          {isQuickAdd && quickRecord ? (
            <div className="mt-5 flex items-center gap-3 rounded-xl bg-[#FFF4E8]/5 px-3 py-2.5">
              <span className="relative block size-11 shrink-0 overflow-hidden rounded-md bg-[#1A1222]">
                {quickRecord.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={quickRecord.imageUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="grid size-full place-items-center text-[8px] uppercase tracking-[0.1em] text-[#FFF4E8]/34">
                    Wax
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium leading-tight text-[#FFF4E8]">
                  {quickRecord.title}
                </span>
                <span className="mt-0.5 block truncate text-[11px] leading-tight text-[#FFF4E8]/44">
                  {quickRecord.artist}
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-[#FFF4E8]/8 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-[#FFF4E8]/54">
                {quickCurrentGroup ||
                  (quickRecord.status === "wanted" ? "Wantlist" : "Unsorted")}
              </span>
            </div>
          ) : null}

          {isQuickAdd ? (
            <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#FFF4E8]/42">
                Groups
              </p>
              {groupNames.length > 0 ? (
                <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
                  {groupNames.map((name) => {
                    const isCurrent =
                      name.toLowerCase() ===
                      quickCurrentGroup.toLowerCase();
                    const isPending = pendingGroup === name;

                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => void assignQuickRecord(name)}
                        disabled={isCurrent || isBusy}
                        aria-label={
                          isCurrent
                            ? `${name} (current group)`
                            : `Add to ${name}`
                        }
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF4E8]/40",
                          isCurrent
                            ? "bg-[#FFF4E8]/5 text-[#FFF4E8]/38"
                            : "bg-[#FFF4E8]/8 text-[#FFF4E8] hover:bg-[#FFF4E8]/14",
                        )}
                      >
                        <span className="truncate">{name}</span>
                        {isCurrent ? (
                          <Check
                            className="size-3.5 shrink-0"
                            aria-hidden="true"
                          />
                        ) : isPending ? (
                          <Loader2
                            className="size-3.5 shrink-0 animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <Plus
                            className="size-3.5 shrink-0 text-[#FFF4E8]/54"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2.5 rounded-xl bg-[#FFF4E8]/5 px-3.5 py-4 text-xs leading-5 text-[#FFF4E8]/44">
                  No groups yet. Name the first one below.
                </p>
              )}

              <div className="mt-5 grid gap-2">
                <label
                  htmlFor="group-dialog-name"
                  className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#FFF4E8]/42"
                >
                  {groupNames.length > 0 ? "New group" : "Group name"}
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    id="group-dialog-name"
                    value={group}
                    autoFocus={groupNames.length === 0}
                    onKeyDown={handleGroupKeyDown}
                    onChange={(event) => {
                      setGroup(event.target.value);
                      setError(null);
                    }}
                    placeholder="Studio"
                    maxLength={80}
                    autoComplete="off"
                    className="h-10 min-w-0 flex-1 rounded-xl border-transparent bg-[#FFF4E8]/8 px-3.5 text-sm text-[#FFF4E8] placeholder:text-[#FFF4E8]/38 focus-visible:border-[#FFF4E8]/18 focus-visible:ring-[#FFF4E8]/10"
                  />
                  <Button
                    type="button"
                    onClick={() => void save()}
                    disabled={!canSave}
                    className="h-10 shrink-0 rounded-full bg-[#FFF4E8] px-4 text-xs text-[#08030F] hover:bg-[#f6dfc9] disabled:opacity-45"
                  >
                    {pendingGroup !== null ? (
                      <Loader2
                        className="size-3.5 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Plus className="size-3.5" aria-hidden="true" />
                    )}
                    {isExistingGroupName ? "Add" : "Create & add"}
                  </Button>
                </div>
                {isQuickGroupCurrent ? (
                  <p className="text-[11px] text-[#FFF4E8]/38">
                    This record is already in {quickCurrentGroup}.
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              <div className="mt-6 grid gap-2">
                <label
                  htmlFor="group-dialog-name"
                  className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#FFF4E8]/42"
                >
                  Group
                </label>
                <Input
                  id="group-dialog-name"
                  list="waxlist-group-names"
                  value={group}
                  // The dialog opens for one job: naming the group. Put the cursor
                  // here so an existing name can be picked or a new one typed.
                  autoFocus
                  onKeyDown={handleGroupKeyDown}
                  onChange={(event) => {
                    setGroup(event.target.value);
                    setError(null);
                  }}
                  placeholder="Studio"
                  maxLength={80}
                  autoComplete="off"
                  className="h-10 rounded-xl border-transparent bg-[#FFF4E8]/8 px-3.5 text-sm text-[#FFF4E8] placeholder:text-[#FFF4E8]/38 focus-visible:border-[#FFF4E8]/18 focus-visible:ring-[#FFF4E8]/10"
                />
                <datalist id="waxlist-group-names">
                  {groupNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
                {groupNames.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {groupNames.map((name) => {
                      const isActive = name.toLowerCase() === normalizedGroup;

                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => {
                            setGroup(name);
                            setError(null);
                          }}
                          aria-pressed={isActive}
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF4E8]/40",
                            isActive
                              ? "bg-[#FFF4E8] text-[#08030F]"
                              : "bg-[#FFF4E8]/7 text-[#FFF4E8]/62 hover:bg-[#FFF4E8]/12 hover:text-[#FFF4E8]",
                          )}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className="mt-6 flex min-h-0 flex-1 flex-col">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#FFF4E8]/42">
                    Records
                    <span className="ml-2 normal-case tracking-normal text-[#FFF4E8]/34">
                      {selectedAvailableCount.toLocaleString()} selected
                    </span>
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={toggleAll}
                      disabled={availableRecords.length === 0}
                      className="rounded-full px-2.5 py-1 text-[11px] font-medium text-[#FFF4E8]/58 transition hover:bg-[#FFF4E8]/8 hover:text-[#FFF4E8] disabled:opacity-40"
                    >
                      {allAvailableSelected ? "Clear" : "Select all"}
                    </button>
                  </div>
                </div>

                <div className="relative mt-2.5">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#FFF4E8]/36"
                    aria-hidden="true"
                  />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Find a record"
                    aria-label="Find a record"
                    className="h-9 rounded-full border-transparent bg-[#FFF4E8]/6 pl-9 pr-3 text-xs text-[#FFF4E8] placeholder:text-[#FFF4E8]/36 focus-visible:border-[#FFF4E8]/16 focus-visible:ring-[#FFF4E8]/10"
                  />
                </div>

                <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
                  {availableRecords.length === 0 ? (
                    <p className="rounded-xl bg-[#FFF4E8]/5 px-3.5 py-5 text-xs leading-5 text-[#FFF4E8]/44">
                      {records.length === 0
                        ? "Add a record before creating a group."
                        : "Every record is already in this group."}
                    </p>
                  ) : (
                    <ul className="grid gap-1.5 sm:grid-cols-2">
                      {availableRecords.map((record) => {
                        const isSelected = selectedIds.has(record.id);

                        return (
                          <li key={record.id}>
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={isSelected}
                              onClick={() => toggleRecord(record.id)}
                              className={cn(
                                "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF4E8]/40",
                                isSelected
                                  ? "bg-[#FFF4E8]/12"
                                  : "hover:bg-[#FFF4E8]/7",
                              )}
                            >
                              <span
                                aria-hidden="true"
                                className={cn(
                                  "grid size-5 shrink-0 place-items-center rounded-md transition",
                                  isSelected
                                    ? "bg-[#FFF4E8] text-[#08030F]"
                                    : "bg-[#FFF4E8]/8 text-transparent",
                                )}
                              >
                                <Check className="size-3" />
                              </span>
                              <span className="relative block size-10 shrink-0 overflow-hidden rounded-md bg-[#1A1222]">
                                {record.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={record.imageUrl}
                                    alt=""
                                    loading="lazy"
                                    decoding="async"
                                    referrerPolicy="no-referrer"
                                    className="size-full object-cover"
                                  />
                                ) : (
                                  <span className="grid size-full place-items-center text-[8px] uppercase tracking-[0.1em] text-[#FFF4E8]/34">
                                    Wax
                                  </span>
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-medium leading-tight text-[#FFF4E8]">
                                  {record.title}
                                </span>
                                <span className="mt-0.5 block truncate text-[11px] leading-tight text-[#FFF4E8]/44">
                                  {record.artist}
                                  {record.group ? ` · ${record.group}` : ""}
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}

          {error ? (
            <p role="alert" className="mt-3 text-xs leading-5 text-[#FFD4B5]">
              {error}
            </p>
          ) : null}

          <div className="mt-5 flex flex-col-reverse gap-2 border-t-0 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="hidden text-[11px] text-[#FFF4E8]/38 sm:block">
              {isQuickAdd
                ? "One tap files the record."
                : group.trim()
                  ? `Moving into ${group.trim()}`
                  : "Name a group to continue"}
            </p>
            <div className="flex items-center gap-2 sm:justify-end">
              <Dialog.Close asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 rounded-full px-4 text-xs text-[#FFF4E8]/64 hover:bg-[#FFF4E8]/8 hover:text-[#FFF4E8]"
                >
                  {isQuickAdd ? "Done" : "Cancel"}
                </Button>
              </Dialog.Close>
              {isQuickAdd ? null : (
                <Button
                  type="button"
                  onClick={() => void save()}
                  disabled={!canSave}
                  className="h-9 rounded-full bg-[#FFF4E8] px-4 text-xs text-[#08030F] hover:bg-[#f6dfc9] disabled:opacity-45"
                >
                  {isSaving ? (
                    <Loader2
                      className="size-3.5 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Plus className="size-3.5" aria-hidden="true" />
                  )}
                  Add to group
                </Button>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
