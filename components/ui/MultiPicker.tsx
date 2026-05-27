"use client";

import { useId, useMemo, useState } from "react";
import { StabilityBadge } from "./Badge";

export interface MultiPickerItem {
  name: string;
  title?: string;
  description?: string;
  tooltip?: string;
  stability?: string;
  cube?: string;
  disabled?: boolean;
  disabledReason?: string;
}

interface MultiPickerProps {
  label?: string;
  items: MultiPickerItem[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
  searchPlaceholder?: string;
}

/**
 * Searchable multi-select chip picker shared by MeasureSelector,
 * DimensionSelector, and SegmentSelector. Selected items render as
 * removable chips above the dropdown panel.
 */
export function MultiPicker({
  label,
  items,
  value,
  onChange,
  placeholder = "Add…",
  emptyMessage = "No options match.",
  searchPlaceholder = "Search…",
}: MultiPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputId = useId();
  const selected = useMemo(() => new Set(value), [value]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const hay = [it.name, it.title, it.description, it.tooltip]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  function toggle(name: string) {
    if (selected.has(name)) {
      onChange(value.filter((v) => v !== name));
    } else {
      onChange([...value, name]);
    }
  }

  function remove(name: string) {
    onChange(value.filter((v) => v !== name));
  }

  const selectedItems = value
    .map((name) => items.find((i) => i.name === name) || { name })
    .filter(Boolean) as MultiPickerItem[];

  return (
    <div>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold uppercase tracking-wider text-zinc-400"
        >
          {label}
        </label>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {selectedItems.length === 0 && (
          <span className="text-xs italic text-zinc-500">None selected</span>
        )}
        {selectedItems.map((it) => (
          <span
            key={it.name}
            className="group inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs text-amber-200"
            title={it.tooltip || it.description || it.name}
          >
            <span className="font-medium">{it.title || it.name}</span>
            <button
              type="button"
              aria-label={`Remove ${it.title || it.name}`}
              onClick={() => remove(it.name)}
              className="rounded-full text-amber-300/70 hover:text-amber-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-300"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="relative mt-2">
        <input
          id={inputId}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Delay so onClick on the option fires first.
            setTimeout(() => setOpen(false), 150);
          }}
          placeholder={placeholder}
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-400/60 focus:outline-none focus:ring-1 focus:ring-amber-400/40"
        />
        {open && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md border border-zinc-700 bg-zinc-900 shadow-xl shadow-black/40">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-zinc-500">
                {query ? emptyMessage : searchPlaceholder}
              </div>
            ) : (
              filtered.map((it) => {
                const isSelected = selected.has(it.name);
                return (
                  <button
                    key={it.name}
                    type="button"
                    onClick={() => toggle(it.name)}
                    disabled={it.disabled && !isSelected}
                    title={it.disabledReason || it.tooltip || it.description}
                    className={`flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? "bg-amber-500/10 text-amber-100"
                        : it.disabled
                          ? "cursor-not-allowed text-zinc-600"
                          : "text-zinc-200 hover:bg-zinc-800"
                    }`}
                  >
                    <span className="flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-medium">
                          {it.title || it.name}
                        </span>
                        <StabilityBadge stability={it.stability} />
                      </span>
                      {it.description && (
                        <span className="mt-0.5 block text-xs text-zinc-500">
                          {it.description}
                        </span>
                      )}
                      <span className="mt-0.5 block font-mono text-[10px] text-zinc-600">
                        {it.name}
                      </span>
                      {it.disabled && it.disabledReason && (
                        <span className="mt-0.5 block text-[11px] text-rose-400">
                          {it.disabledReason}
                        </span>
                      )}
                    </span>
                    <span
                      aria-hidden
                      className={`mt-0.5 ${isSelected ? "text-amber-300" : "text-zinc-600"}`}
                    >
                      {isSelected ? "✓" : "+"}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
