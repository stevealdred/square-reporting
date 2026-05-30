import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import {
  entraTenantIdFromSignIn,
  isEntraTenantAllowed,
  resolveEntraIssuer,
} from "@/lib/entraTenants";
import {
  getAuthSecret,
  isMainPageSsoEnabled,
  isMainPageSsoMisconfigured,
} from "@/lib/mainPageAuth";

const ssoEnabled = isMainPageSsoEnabled();
const entraIssuer = resolveEntraIssuer();

if (isMainPageSsoMisconfigured()) {
  console.error(
    "[auth] ENTEGRAID_MAIN_PAGE_SSO_ENABLED=true but AUTH_SECRET, Microsoft Entra ID credentials, and/or AUTH_MICROSOFT_ENTRA_ID_ALLOWED_TENANTS are missing.",
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret:
    getAuthSecret() ??
    (ssoEnabled ? undefined : "entegraid-main-page-sso-disabled"),
  providers: ssoEnabled
    ? [
        MicrosoftEntraID({
          clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
          clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
          ...(entraIssuer ? { issuer: entraIssuer } : {}),
          authorization: {
            params: {
              scope: "openid profile email",
              prompt: "select_account",
            },
          },
        }),
      ]
    : [],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    signIn({ account, profile }) {
      if (account?.provider !== "microsoft-entra-id") {
        return true;
      }
      const tenantId = entraTenantIdFromSignIn(account, profile);
      if (!isEntraTenantAllowed(tenantId)) {
        console.warn(
          "[auth] Sign-in rejected: tenant not in AUTH_MICROSOFT_ENTRA_ID_ALLOWED_TENANTS",
          tenantId ?? "(unknown)",
        );
        return false;
      }
      return true;
    },
  },
  trustHost: true,
});
