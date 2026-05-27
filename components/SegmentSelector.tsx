"use client";

import { MultiPicker, type MultiPickerItem } from "./ui/MultiPicker";
import type { SegmentMeta } from "@/lib/types";

interface SegmentSelectorProps {
  segments: SegmentMeta[];
  value: string[];
  onChange: (next: string[]) => void;
}

export function SegmentSelector({ segments, value, onChange }: SegmentSelectorProps) {
  const items: MultiPickerItem[] = segments.map((s) => ({
    name: s.name,
    title: s.meta?.label || s.title,
    description: s.description,
    tooltip: s.meta?.tooltip,
    stability: s.meta?.stability as string | undefined,
  }));
  return (
    <MultiPicker
      items={items}
      value={value}
      onChange={onChange}
      placeholder="Add segments…"
      emptyMessage="No segments match."
      searchPlaceholder="Search segments…"
    />
  );
}
