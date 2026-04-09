import { NextRequest, NextResponse, userAgent } from "next/server";

const COOKIE_NAME = "venozza_view_preference";

export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const { pathname, searchParams } = url;

  // Só atua na home
  if (pathname !== "/") {
    return NextResponse.next();
  }

  // Override manual via query string
  const forcedView = searchParams.get("view");

  if (forcedView === "site") {
    const response = NextResponse.next();
    response.cookies.set(COOKIE_NAME, "site", {
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 dias
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
      maxAge: 60 * 60 * 24 * 30, // 30 dias
      sameSite: "lax",
    });
    return response;
  }

  // Preferência persistida
  const savedPreference = request.cookies.get(COOKIE_NAME)?.value;

  if (savedPreference === "site") {
    return NextResponse.next();
  }

  if (savedPreference === "mobile") {
    url.pathname = "/m";
    return NextResponse.redirect(url);
  }

  // Detecção oficial do Next
  const { device } = userAgent(request);
  const deviceType = device.type;

  if (deviceType === "mobile" || deviceType === "tablet") {
    url.pathname = "/m";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
