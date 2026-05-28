import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isMainPageSsoEnabled } from "@/lib/mainPageAuth";

export default auth((req) => {
  if (!isMainPageSsoEnabled()) {
    return;
  }

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
});

export const config = {
  matcher: ["/", "/login"],
};
