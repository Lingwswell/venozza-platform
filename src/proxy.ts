import { NextRequest, NextResponse, userAgent } from "next/server";

const COOKIE_NAME = "venozza_view_preference";

export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const { pathname, searchParams } = url;

  // 🔥 PROTEÇÃO ADMIN
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const token =
      request.cookies.get("venozza_token")?.value ||
      request.headers.get("authorization");

    if (!token) {
      const loginUrl = new URL("/admin/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ===== MOBILE / SITE (já existia) =====

  if (pathname !== "/") {
    return NextResponse.next();
  }

  const forcedView = searchParams.get("view");

  if (forcedView === "site") {
    const response = NextResponse.next();
    response.cookies.set(COOKIE_NAME, "site", {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });
    return response;
  }

  if (forcedView === "mobile") {
    url.pathname = "/m";
    url.searchParams.delete("view");

    const response = NextResponse.redirect(url);
    response.cookies.set(COOKIE_NAME, "mobile", {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });
    return response;
  }

  const savedPreference = request.cookies.get(COOKIE_NAME)?.value;

  if (savedPreference === "site") {
    return NextResponse.next();
  }

  if (savedPreference === "mobile") {
    url.pathname = "/m";
    return NextResponse.redirect(url);
  }

  const { device } = userAgent(request);

  if (device.type === "mobile" || device.type === "tablet") {
    url.pathname = "/m";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/admin/:path*"],
};
