"use client";

import { useId } from "react";
import type { OrderClause, OrderDirection } from "@/lib/types";

interface OrderLimitControlsProps {
  /**
   * The members eligible for ordering — i.e. selected measures, dimensions,
   * and time dimensions. The user picks any one of these.
   */
  orderableMembers: Array<{ name: string; title?: string }>;
  order: OrderClause | null;
  limit: number;
  offset: number;
  onOrderChange: (next: OrderClause | null) => void;
  onLimitChange: (next: number) => void;
  onOffsetChange: (next: number) => void;
}

export function OrderLimitControls({
  orderableMembers,
  order,
  limit,
  offset,
  onOrderChange,
  onLimitChange,
  onOffsetChange,
}: OrderLimitControlsProps) {
  const orderMemberId = useId();
  const orderDirId = useId();
  const limitId = useId();
  const offsetId = useId();

  const currentMember = order ? Object.keys(order)[0] : "";
  const currentDir = currentMember ? order![currentMember] : "asc";

  function setOrderMember(name: string) {
    if (!name) {
      onOrderChange(null);
      return;
    }
    onOrderChange({ [name]: currentDir as OrderDirection });
  }

  function setOrderDir(dir: OrderDirection) {
    if (!currentMember) return;
    onOrderChange({ [currentMember]: dir });
  }

  return (
    <div className="space-y-3">
      <div>
        <label
          htmlFor={orderMemberId}
          className="block text-xs font-medium text-zinc-400"
        >
          Order by
        </label>
        <div className="mt-1 flex gap-2">
          <select
            id={orderMemberId}
            value={currentMember}
            onChange={(e) => setOrderMember(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 focus:border-amber-400/60 focus:outline-none"
          >
            <option value="">— None —</option>
            {orderableMembers.map((m) => (
              <option key={m.name} value={m.name}>
                {m.title || m.name}
              </option>
            ))}
          </select>
          <select
            id={orderDirId}
            aria-label="Sort direction"
            value={currentDir}
            disabled={!currentMember}
            onChange={(e) => setOrderDir(e.target.value as OrderDirection)}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 focus:border-amber-400/60 focus:outline-none disabled:opacity-50"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label
            htmlFor={limitId}
            className="block text-xs font-medium text-zinc-400"
          >
            Limit
          </label>
          <input
            id={limitId}
            type="number"
            min={1}
            max={50000}
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value) || 1000)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 focus:border-amber-400/60 focus:outline-none"
          />
        </div>
        <div>
          <label
            htmlFor={offsetId}
            className="block text-xs font-medium text-zinc-400"
          >
            Offset
          </label>
          <input
            id={offsetId}
            type="number"
            min={0}
            value={offset}
            onChange={(e) => onOffsetChange(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 focus:border-amber-400/60 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
