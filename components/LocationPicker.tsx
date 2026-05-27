"use client";

import { ChipInput } from "./ui/ChipInput";
import { MultiPicker, type MultiPickerItem } from "./ui/MultiPicker";
import { useLocations } from "@/lib/useLocations";

interface LocationPickerProps {
  values: string[];
  onChange: (next: string[]) => void;
}

/**
 * Friendly multi-select for location IDs. Loads `/api/locations` lazily
 * (when this component mounts), shows location names + city/state in the
 * dropdown, but stores raw location IDs in the filter `values` array so the
 * Reporting API receives what it expects.
 *
 * If loading fails (e.g. the token lacks the MERCHANT_PROFILE_READ scope) we
 * surface the error and fall back to the generic chip input so the user can
 * still type IDs by hand.
 */
export function LocationPicker({ values, onChange }: LocationPickerProps) {
  const { data, error, isLoading } = useLocations();

  if (isLoading) {
    return (
      <p className="text-[11px] italic text-zinc-500">Loading locations…</p>
    );
  }

  if (error || !data?.ok || !data.locations) {
    const message =
      error instanceof Error
        ? error.message
        : data?.error || "Could not load locations.";
    return (
      <div className="space-y-1">
        <p className="text-[11px] text-amber-300">
          Locations API unavailable ({message}). Falling back to ID input.
        </p>
        <ChipInput
          values={values}
          onChange={onChange}
          placeholder="Type a location ID and press Enter"
        />
      </div>
    );
  }

  const locations = data.locations;

  // Sort active locations first, then alphabetically by name.
  const sorted = [...locations].sort((a, b) => {
    const aActive = (a.status || "ACTIVE") === "ACTIVE" ? 0 : 1;
    const bActive = (b.status || "ACTIVE") === "ACTIVE" ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return (a.name || a.id).localeCompare(b.name || b.id);
  });

  const items: MultiPickerItem[] = sorted.map((loc) => {
    const subtitleParts = [
      loc.address?.locality,
      loc.address?.administrative_district_level_1,
    ].filter((s): s is string => !!s);
    const subtitle = subtitleParts.length ? subtitleParts.join(", ") : undefined;
    return {
      name: loc.id,
      title: loc.name || loc.id,
      description: subtitle,
      tooltip: subtitle ? `${loc.name || loc.id} — ${subtitle}` : loc.name,
      stability:
        (loc.status || "ACTIVE") === "ACTIVE" ? undefined : "deprecated",
    };
  });

  return (
    <MultiPicker
      items={items}
      value={values}
      onChange={onChange}
      placeholder="Search locations by name…"
      searchPlaceholder="Search locations…"
      emptyMessage="No locations match."
    />
  );
}
