"use client";

import { MultiPicker, type MultiPickerItem } from "./ui/MultiPicker";
import type { MeasureMeta } from "@/lib/types";

interface MeasureSelectorProps {
  measures: MeasureMeta[];
  value: string[];
  onChange: (next: string[]) => void;
}

export function MeasureSelector({ measures, value, onChange }: MeasureSelectorProps) {
  const items: MultiPickerItem[] = measures.map((m) => ({
    name: m.name,
    title: m.meta?.label || m.title,
    description: m.description,
    tooltip: m.meta?.tooltip,
    stability: m.meta?.stability as string | undefined,
  }));
  return (
    <MultiPicker
      items={items}
      value={value}
      onChange={onChange}
      placeholder="Add measures…"
      emptyMessage="No measures match this search."
      searchPlaceholder="Search measures by name, title, or description"
    />
  );
}
