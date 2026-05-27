"use client";

import { MultiPicker, type MultiPickerItem } from "./ui/MultiPicker";
import type { DimensionMeta } from "@/lib/types";

interface DimensionSelectorProps {
  dimensions: DimensionMeta[];
  value: string[];
  onChange: (next: string[]) => void;
  /** When true, time-typed dimensions are hidden — they belong in TimeDimensionEditor. */
  excludeTime?: boolean;
}

export function DimensionSelector({
  dimensions,
  value,
  onChange,
  excludeTime = true,
}: DimensionSelectorProps) {
  const items: MultiPickerItem[] = dimensions
    .filter((d) => (excludeTime ? d.type !== "time" : true))
    .map((d) => ({
      name: d.name,
      title: d.meta?.label || d.title,
      description: d.description,
      tooltip: d.meta?.tooltip,
      stability: d.meta?.stability as string | undefined,
    }));
  return (
    <MultiPicker
      items={items}
      value={value}
      onChange={onChange}
      placeholder="Add dimensions…"
      emptyMessage="No dimensions match this search."
      searchPlaceholder="Search dimensions by name, title, or description"
    />
  );
}
