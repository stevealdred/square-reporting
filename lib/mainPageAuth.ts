/**
 * Gates only the reporting UI at `/`. API routes and other paths are unaffected.
 */
export function isMainPageSsoEnabled(): boolean {
  if (process.env.ENTEGRAID_MAIN_PAGE_SSO_ENABLED === "false") {
    return false;
  }
  if (process.env.ENTEGRAID_MAIN_PAGE_SSO_ENABLED === "true") {
    return hasEntegraidSsoConfig();
  }
  return hasEntegraidSsoConfig();
}

function hasEntegraidSsoConfig(): boolean {
  return Boolean(
    process.env.AUTH_SECRET &&
      process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
      process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
  );
}
