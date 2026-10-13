/**
 * Excel's Web connector probes the site root with Authorization: Bearer
 * (an empty token) before it will use Organizational account.
 * It accepts the sign-in only when that probe is a 401 with an unquoted
 * v1 authorization_uri. A redirect to /login, or a quoted v2 URL, makes
 * Excel report that this credential type isn't supported.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getAllowedEntraTenants, resolveEntraIssuer } from "@/lib/entraTenants";

export function isExcelBearerProbe(req: NextRequest): boolean {
  const header = req.headers.get("authorization");
  return Boolean(header && /^Bearer\b/i.test(header));
}

export function excelAuthorizationUri(): string {
  const issuer = resolveEntraIssuer();
  if (issuer?.includes("/organizations")) {
    return "https://login.microsoftonline.com/organizations/oauth2/authorize";
  }
  const tenants = getAllowedEntraTenants();
  if (tenants.length === 1) {
    return `https://login.microsoftonline.com/${tenants[0]}/oauth2/authorize`;
  }
  return "https://login.microsoftonline.com/organizations/oauth2/authorize";
}

export function excelWwwAuthenticate(): string {
  return `Bearer authorization_uri=${excelAuthorizationUri()}`;
}

export function excelSignInRequired(): NextResponse {
  return NextResponse.json(
    { error: "Sign in required." },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": excelWwwAuthenticate(),
      },
    },
  );
}
