"use client";

import { useMemo, useState } from "react";
import { StabilityBadge } from "./ui/Badge";
import type { CubeMeta } from "@/lib/types";

interface CubePickerProps {
  cubes: CubeMeta[];
  value: string | null;
  onChange: (cubeName: string) => void;
}

/**
 * Lists views first (recommended starting point), then raw cubes. Each entry
 * exposes its description and `meta.stability` badge so users understand
 * what they're picking.
 */
export function CubePicker({ cubes, value, onChange }: CubePickerProps) {
  const [search, setSearch] = useState("");
  const { views, rawCubes } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = (c: CubeMeta) => {
      if (!q) return true;
      return [c.name, c.title, c.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    };
    const views: CubeMeta[] = [];
    const rawCubes: CubeMeta[] = [];
    for (const c of cubes) {
      if (!matches(c)) continue;
      if (c.type === "view") views.push(c);
      else rawCubes.push(c);
    }
    const byTitle = (a: CubeMeta, b: CubeMeta) =>
      (a.title || a.name).localeCompare(b.title || b.name);
    views.sort(byTitle);
    rawCubes.sort(byTitle);
    return { views, rawCubes };
  }, [cubes, search]);

  return (
    <div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search cubes & views…"
        className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-400/60 focus:outline-none focus:ring-1 focus:ring-amber-400/40"
      />
      <div className="mt-3 max-h-80 space-y-3 overflow-y-auto pr-1">
        <Group label="Views (recommended)" cubes={views} value={value} onChange={onChange} />
        <Group label="Cubes (advanced)" cubes={rawCubes} value={value} onChange={onChange} />
      </div>
    </div>
  );
}

function Group({
  label,
  cubes,
  value,
  onChange,
}: {
  label: string;
  cubes: CubeMeta[];
  value: string | null;
  onChange: (n: string) => void;
}) {
  if (cubes.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <ul className="space-y-1">
        {cubes.map((c) => {
          const isSelected = value === c.name;
          return (
            <li key={c.name}>
              <button
                type="button"
                onClick={() => onChange(c.name)}
                className={`flex w-full items-start justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
                  isSelected
                    ? "border-amber-400/50 bg-amber-500/10 text-amber-50"
                    : "border-transparent bg-zinc-950/40 text-zinc-200 hover:border-zinc-700 hover:bg-zinc-900"
                }`}
              >
                <span className="flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold">
                      {c.title || c.name}
                    </span>
                    <StabilityBadge
                      stability={c.meta?.stability as string | undefined}
                    />
                  </span>
                  {c.description && (
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      {c.description}
                    </span>
                  )}
                  <span className="mt-0.5 block font-mono text-[10px] text-zinc-600">
                    {c.name}
                  </span>
                </span>
                <span
                  aria-hidden
                  className={`text-xs ${isSelected ? "text-amber-300" : "text-zinc-600"}`}
                >
                  {isSelected ? "●" : "○"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
