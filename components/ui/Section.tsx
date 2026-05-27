"use client";

import { useId, useState, type ReactNode } from "react";

interface SectionProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  badge?: ReactNode;
  children: ReactNode;
}

export function Section({
  title,
  description,
  defaultOpen = true,
  badge,
  children,
}: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-900/40">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 rounded-t-xl px-4 py-3 text-left hover:bg-zinc-900/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold uppercase tracking-wider text-zinc-200">
            {title}
          </span>
          {badge}
        </div>
        <span
          aria-hidden
          className={`text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>
      {description && open && (
        <p className="px-4 pb-1 text-xs text-zinc-500">{description}</p>
      )}
      {open && (
        <div id={id} className="px-4 pb-4 pt-1">
          {children}
        </div>
      )}
    </section>
  );
}
