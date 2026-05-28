import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Same-origin requests (Agnes UI → Agnes API) pass through without a key
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || (host && origin.includes(host))) {
    return NextResponse.next();
  }

  // Cross-origin callers must supply the API key
  const key = request.headers.get("x-agnes-api-key");
  if (key !== process.env.AGNES_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
