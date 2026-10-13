"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";

interface AccountInfo {
  id: string;
  label: string;
}

interface AccountsResponse {
  ok: boolean;
  accounts?: AccountInfo[];
  activeId?: string | null;
  error?: string;
}

const fetcher = async (url: string): Promise<AccountsResponse> => {
  const res = await fetch(url, { method: "GET" });
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    json = { ok: false, error: `Invalid response (HTTP ${res.status})` };
  }
  return json as AccountsResponse;
};

interface AccountSwitcherProps {
  onChanged?: (accountId: string) => void;
  className?: string;
}

export function AccountSwitcher({ onChanged, className }: AccountSwitcherProps) {
  const { data, mutate } = useSWR<AccountsResponse>("/api/accounts", fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  });
  const [isSwitching, setIsSwitching] = useState(false);

  const accounts = data?.ok ? data.accounts ?? [] : [];
  const activeId = data?.ok ? data.activeId ?? accounts[0]?.id ?? "" : "";

  const switchAccount = useCallback(
    async (accountId: string) => {
      if (!accountId || accountId === activeId || isSwitching) return;
      setIsSwitching(true);
      try {
        const res = await fetch("/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId }),
        });
        const json = (await res.json()) as AccountsResponse;
        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Could not switch Square account.");
        }
        await mutate(json, { revalidate: false });
        onChanged?.(accountId);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSwitching(false);
      }
    },
    [activeId, isSwitching, mutate, onChanged],
  );

  if (accounts.length < 2) return null;

  return (
    <label
      className={`inline-flex items-center gap-1.5 ${className ?? ""}`}
      title="Square account"
    >
      <span className="sr-only">Square account</span>
      <select
        value={activeId}
        disabled={isSwitching}
        onChange={(e) => void switchAccount(e.target.value)}
        className="h-8 max-w-[10rem] truncate rounded-md border border-zinc-700 bg-zinc-900 px-2 text-xs font-medium text-zinc-200 hover:border-zinc-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 disabled:opacity-60"
      >
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.label}
          </option>
        ))}
      </select>
    </label>
  );
}
