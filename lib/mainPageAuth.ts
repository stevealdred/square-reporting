/**
 * Gates only the reporting UI at `/`. API routes and other paths are unaffected.
 */

import { getAllowedEntraTenants } from "@/lib/entraTenants";

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function getAuthSecret(): string | undefined {
  return env("AUTH_SECRET");
}

function hasEntegraidSsoConfig(): boolean {
  return Boolean(
    getAuthSecret() &&
      env("AUTH_MICROSOFT_ENTRA_ID_ID") &&
      env("AUTH_MICROSOFT_ENTRA_ID_SECRET"),
  );
}

export function isMainPageSsoEnabled(): boolean {
  if (process.env.ENTEGRAID_MAIN_PAGE_SSO_ENABLED === "false") {
    return false;
  }
  if (process.env.ENTEGRAID_MAIN_PAGE_SSO_ENABLED === "true") {
    return hasEntegraidSsoConfig();
  }
  return hasEntegraidSsoConfig();
}

/**
 * When SSO is requested but misconfigured, Auth.js must not run (MissingSecret).
 */
export function isMainPageSsoMisconfigured(): boolean {
  if (process.env.ENTEGRAID_MAIN_PAGE_SSO_ENABLED !== "true") {
    return false;
  }
  return !hasEntegraidSsoConfig() || getAllowedEntraTenants().length === 0;
}
