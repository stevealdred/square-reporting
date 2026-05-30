import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Session } from "next-auth";
import { isMainPageSsoEnabled } from "@/lib/mainPageAuth";

function gateMainPage(req: NextRequest & { auth: Session | null }) {
  const { pathname } = req.nextUrl;
  const isAuthenticated = Boolean(req.auth);

  if (pathname === "/" && !isAuthenticated) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && isAuthenticated) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let withAuth: ((req: NextRequest, ctx: any) => any) | null = null;

export default async function middleware(req: NextRequest) {
  if (!isMainPageSsoEnabled()) {
    withAuth = null;
    return NextResponse.next();
  }

  if (!withAuth) {
    const { auth } = await import("@/auth");
    withAuth = auth(gateMainPage);
  }

  return withAuth(req, {});
}

export const config = {
  matcher: ["/", "/login"],
};
