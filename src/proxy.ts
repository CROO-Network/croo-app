import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function canonicalizeAgentPath(pathname: string): string | null {
  let path = pathname;
  if (path === "/agent" || path.startsWith("/agent/")) {
    path = `/agents${path.slice("/agent".length)}`;
  }
  const colon = path.match(/^\/agents\/([^/]+):([^/]+)$/);
  if (colon) path = `/agents/${colon[1]}/${colon[2]}`;
  return path !== pathname ? path : null;
}

export function proxy(request: NextRequest) {
  const nextPath = canonicalizeAgentPath(request.nextUrl.pathname);
  if (!nextPath) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = nextPath;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/agents/:path*", "/agent/:path*"],
};
