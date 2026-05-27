"use client";

import { useState, type KeyboardEvent } from "react";

interface ChipInputProps {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

/**
 * Chip-style multi-value input. The visible text input is its own local
 * state so typing is never disturbed by parent re-renders. Pressing Enter,
 * Tab, or a comma commits the current text as a chip; pasting comma- or
 * newline-separated text commits multiple chips at once; backspace on an
 * empty input removes the last chip.
 */
export function ChipInput({
  values,
  onChange,
  placeholder,
}: ChipInputProps) {
  const [draft, setDraft] = useState("");

  function commit(text: string) {
    const parts = text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const set = new Set(values);
    for (const p of parts) set.add(p);
    onChange([...set]);
    setDraft("");
  }

  function flushDraft() {
    if (draft.trim()) commit(draft);
    else setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      if (draft.trim()) {
        e.preventDefault();
        commit(draft);
      }
      return;
    }
    if (e.key === "Backspace" && draft === "" && values.length > 0) {
      e.preventDefault();
      onChange(values.slice(0, -1));
    }
  }

  function removeAt(idx: number) {
    onChange(values.filter((_, i) => i !== idx));
  }

  return (
    <div className="rounded border border-zinc-700 bg-zinc-950 px-1.5 py-1 focus-within:border-amber-400/60">
      <div className="flex flex-wrap items-center gap-1">
        {values.map((v, idx) => (
          <span
            key={`${v}-${idx}`}
            className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-100"
          >
            <span className="break-all">{v}</span>
            <button
              type="button"
              onClick={() => removeAt(idx)}
              aria-label={`Remove ${v}`}
              className="text-amber-300/70 hover:text-amber-100 focus:outline-none"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => {
            const next = e.target.value;
            if (next.includes(",")) {
              commit(next);
              return;
            }
            setDraft(next);
          }}
          onKeyDown={onKeyDown}
          onBlur={flushDraft}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (text.includes(",") || text.includes("\n")) {
              e.preventDefault();
              commit(text.replace(/\n+/g, ","));
            }
          }}
          placeholder={
            values.length
              ? ""
              : placeholder ?? "Type a value, press Enter or comma to add"
          }
          className="min-w-[8ch] flex-1 bg-transparent px-1 py-0.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
        />
      </div>
    </div>
  );
}
