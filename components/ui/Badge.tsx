import type { ReactNode } from "react";
import type { Stability } from "@/lib/types";

const stabilityClasses: Record<Stability, string> = {
  ga: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  beta: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  preview: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  deprecated: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
};

export function StabilityBadge({ stability }: { stability?: string }) {
  if (!stability) return null;
  const cls =
    stabilityClasses[stability as Stability] ??
    "bg-zinc-700/40 text-zinc-300 ring-zinc-700/40";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${cls}`}
    >
      {stability}
    </span>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "info" | "warn" | "danger" | "success";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-zinc-800 text-zinc-300 ring-zinc-700",
    info: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
    warn: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    danger: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
    success: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
