import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isValid } from "@/lib/session";

// Her desk and every route that writes are behind the one demo login.
// Reading the audience pages stays open, because that is the product.
const PROTECTED = [
  "/studio",
  "/api/answer",
  "/api/patch",
  "/api/ingest",
];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (!PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  if (await isValid(req.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  if (path.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Sign in to the studio first." },
      { status: 401 },
    );
  }

  const to = req.nextUrl.clone();
  to.pathname = "/login";
  to.search = `?next=${encodeURIComponent(path)}`;
  return NextResponse.redirect(to);
}

export const config = {
  matcher: ["/studio/:path*", "/api/answer", "/api/patch", "/api/ingest"],
};
