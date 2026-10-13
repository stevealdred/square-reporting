/**
 * Env-configured Square merchant accounts.
 *
 * Set `SQUARE_ACCOUNTS=id:Label,id2:Label2` and one token env var per id
 * (`SQUARE_ACCESS_TOKEN_<ID>` with non-alnum → `_`). When unset, fall back to
 * a single `SQUARE_ACCESS_TOKEN` (no account switcher).
 */

export const SQUARE_ACCOUNT_COOKIE = "square_account_id";

export interface SquareAccount {
  id: string;
  label: string;
}

const LEGACY_ACCOUNT_ID = "default";

function tokenEnvName(accountId: string): string {
  return `SQUARE_ACCESS_TOKEN_${accountId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
}

/**
 * Parse `SQUARE_ACCOUNTS` into `{ id, label }[]`. Returns a single legacy
 * account when the multi-account env var is unset but `SQUARE_ACCESS_TOKEN` is set.
 */
export function listAccounts(): SquareAccount[] {
  const raw = process.env.SQUARE_ACCOUNTS?.trim();
  if (raw) {
    const accounts: SquareAccount[] = [];
    for (const part of raw.split(",")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const colon = trimmed.indexOf(":");
      if (colon <= 0) continue;
      const id = trimmed.slice(0, colon).trim();
      const label = trimmed.slice(colon + 1).trim();
      if (!id || !label) continue;
      if (!/^[a-zA-Z0-9_-]+$/.test(id)) continue;
      accounts.push({ id, label });
    }
    return accounts;
  }

  if (process.env.SQUARE_ACCESS_TOKEN?.trim()) {
    return [{ id: LEGACY_ACCOUNT_ID, label: "Square account" }];
  }
  return [];
}

export function isValidAccountId(accountId: string): boolean {
  return listAccounts().some((a) => a.id === accountId);
}

export function defaultAccountId(): string | null {
  return listAccounts()[0]?.id ?? null;
}

/**
 * Resolve which account id to use given an optional cookie/request value.
 * Invalid or missing ids fall back to the first configured account.
 */
export function resolveAccountId(requested?: string | null): string | null {
  const accounts = listAccounts();
  if (accounts.length === 0) return null;
  if (requested && accounts.some((a) => a.id === requested)) return requested;
  return accounts[0].id;
}

/**
 * Look up the access token for an account id. Legacy single-token mode uses
 * `SQUARE_ACCESS_TOKEN` for the synthetic `default` account.
 */
export function resolveAccountToken(accountId?: string | null): string {
  const id = resolveAccountId(accountId);
  if (!id) {
    throw new Error(
      "No Square account configured. Set SQUARE_ACCESS_TOKEN, or SQUARE_ACCOUNTS plus per-account SQUARE_ACCESS_TOKEN_<ID> vars.",
    );
  }

  if (id === LEGACY_ACCOUNT_ID && !process.env.SQUARE_ACCOUNTS?.trim()) {
    const token = process.env.SQUARE_ACCESS_TOKEN?.trim();
    if (!token) {
      throw new Error(
        "SQUARE_ACCESS_TOKEN is not set. Add it to .env.local (token must have the REPORTING_READ scope).",
      );
    }
    return token;
  }

  const named = process.env[tokenEnvName(id)]?.trim();
  if (named) return named;

  // Allow SQUARE_ACCESS_TOKEN as fallback for the first account only.
  const accounts = listAccounts();
  if (accounts[0]?.id === id) {
    const fallback = process.env.SQUARE_ACCESS_TOKEN?.trim();
    if (fallback) return fallback;
  }

  throw new Error(
    `Access token for Square account "${id}" is not set. Add ${tokenEnvName(id)} to .env.local.`,
  );
}

export function accountIdFromRequest(
  cookieHeader: string | null | undefined,
): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SQUARE_ACCOUNT_COOKIE}=`));
  if (!match) return null;
  const value = decodeURIComponent(match.slice(SQUARE_ACCOUNT_COOKIE.length + 1));
  return value || null;
}
