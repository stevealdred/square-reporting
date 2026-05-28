import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { isMainPageSsoEnabled } from "@/lib/mainPageAuth";

const entraIssuer = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: isMainPageSsoEnabled()
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
  trustHost: true,
});
