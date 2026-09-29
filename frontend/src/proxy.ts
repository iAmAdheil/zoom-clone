import { NextResponse, type NextRequest } from "next/server";

// Optimistic auth check (see the Next.js authentication guide). With no session cookie, the
// user goes to /signin at once. The pages still call /api/me, because only the backend can
// tell if the cookie is valid.
export function proxy(request: NextRequest) {
  if (request.cookies.has("session")) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const signIn = new URL("/signin", request.url);
  signIn.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(signIn);
}

// Only the pages that need a signed-in user. Join and meeting pages allow guests.
// Prefetch requests are skipped: the router keeps a prefetched redirect, and it would send the
// user back to /signin just after sign in. The page itself checks /api/me anyway.
// Next.js reads this config at build time, so the values must be written out in full.
export const config = {
  matcher: [
    {
      source: "/",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    {
      source: "/schedule",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
