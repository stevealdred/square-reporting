/**
 * Microsoft Entra tenant allowlist for main-page SSO (multi-org).
 */

const TENANT_ID_RE =
  /login\.microsoftonline\.com\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//i;

const GUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeTenantId(id: string): string | undefined {
  const trimmed = id.trim();
  return GUID_RE.test(trimmed) ? trimmed.toLowerCase() : undefined;
}

function extractTenantFromIssuer(issuer: string | undefined): string | undefined {
  if (!issuer?.trim()) return undefined;
  const match = issuer.trim().match(TENANT_ID_RE);
  return match?.[1] ? normalizeTenantId(match[1]) : undefined;
}

/** Allowed directory (tenant) IDs from env, or a single ID parsed from a tenant-scoped issuer URL. */
export function getAllowedEntraTenants(): string[] {
  const raw = process.env.AUTH_MICROSOFT_ENTRA_ID_ALLOWED_TENANTS?.trim();
  if (raw) {
    const seen = new Set<string>();
    for (const part of raw.split(",")) {
      const id = normalizeTenantId(part);
      if (id) seen.add(id);
    }
    return [...seen];
  }

  const fromIssuer = extractTenantFromIssuer(
    process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
  );
  return fromIssuer ? [fromIssuer] : [];
}

export function isEntraTenantAllowed(
  tenantId: string | undefined | null,
): boolean {
  const allowed = getAllowedEntraTenants();
  if (!tenantId || allowed.length === 0) return false;
  const normalized = normalizeTenantId(tenantId);
  if (!normalized) return false;
  return allowed.includes(normalized);
}

/**
 * OIDC issuer for token validation. Multiple allowed tenants use the
 * organizations endpoint; a single tenant can use a tenant-specific issuer.
 */
export function resolveEntraIssuer(): string | undefined {
  const explicit = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER?.trim();
  if (explicit) return explicit;

  const tenants = getAllowedEntraTenants();
  if (tenants.length === 1) {
    return `https://login.microsoftonline.com/${tenants[0]}/v2.0`;
  }
  if (tenants.length > 1) {
    return "https://login.microsoftonline.com/organizations/v2.0";
  }
  return undefined;
}

export function entraTenantIdFromSignIn(
  account: unknown,
  profile: unknown,
): string | undefined {
  if (account && typeof account === "object" && "tenantId" in account) {
    const { tenantId } = account as { tenantId?: unknown };
    if (typeof tenantId === "string") {
      const normalized = normalizeTenantId(tenantId);
      if (normalized) return normalized;
    }
  }
  if (profile && typeof profile === "object" && "tid" in profile) {
    const tid = (profile as { tid?: unknown }).tid;
    if (typeof tid === "string") return normalizeTenantId(tid);
  }
  return undefined;
}
