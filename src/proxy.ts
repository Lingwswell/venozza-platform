import { NextRequest, NextResponse, userAgent } from "next/server";

const COOKIE_NAME = "venozza_view_preference";

// Rotas que exigem login valido. O proxy recusa com 401 antes de chegar na rota.
function needsSession(pathname: string, method: string) {
  if (pathname.startsWith("/api/admin/")) return true;
  if (pathname === "/api/orders" && method === "GET") return true;
  return /^\/api\/orders\/[^/]+\/status$/.test(pathname);
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function isValidSessionToken(token: string) {
  const secret = process.env.JWT_SECRET;
  const parts = token.split(".");

  if (!secret || parts.length !== 3) return false;

  try {
    const decoder = new TextDecoder();
    const header = JSON.parse(decoder.decode(base64UrlToBytes(parts[0])));

    if (header.alg !== "HS256") return false;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signatureOk = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(parts[2]),
      encoder.encode(`${parts[0]}.${parts[1]}`)
    );

    if (!signatureOk) return false;

    const payload = JSON.parse(decoder.decode(base64UrlToBytes(parts[1])));

    return typeof payload.exp !== "number" || payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const { pathname, searchParams } = url;

  if (needsSession(pathname, request.method)) {
    const bearer = request.headers.get("authorization");
    const streamToken =
      pathname === "/api/admin/kds/stream" ? searchParams.get("token") : null;
    const token =
      (bearer && bearer.startsWith("Bearer ") ? bearer.slice(7).trim() : "") ||
      (streamToken || "").trim();

    if (!token || !(await isValidSessionToken(token))) {
      return NextResponse.json(
        { ok: false, error: "Sessão expirada ou inválida. Entre novamente." },
        { status: 401 }
      );
    }
  }

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
  matcher: [
    "/",
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/orders",
    "/api/orders/:codigo/status",
  ],
};
