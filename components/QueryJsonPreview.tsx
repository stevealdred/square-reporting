"use client";

import { useState } from "react";
import type { ReportingQuery } from "@/lib/types";

interface QueryJsonPreviewProps {
  query: ReportingQuery;
}

export function QueryJsonPreview({ query }: QueryJsonPreviewProps) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify({ query }, null, 2);

  async function copy() {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* noop */
    }
  }

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Request JSON
        </span>
        <button
          type="button"
          onClick={copy}
          className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 hover:border-zinc-600 hover:text-zinc-100"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="max-h-64 overflow-auto px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-300">
        {json}
      </pre>
    </div>
  );
}
