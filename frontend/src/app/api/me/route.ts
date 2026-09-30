import { NextResponse, type NextRequest } from "next/server";
import { backendUrl } from "@/lib/backendUrl";

// GET /api/me for the browser. The backend answers 401 for a guest, and Chrome logs every 401
// as a red console error. A guest is a normal case, so this route answers 200 with `null`
// instead. It takes the place of the /api/* rewrite in next.config.ts for this one path.
// The backend is not changed. The signed-in answer is passed through as it is.
const noStore = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  // The cookie is HttpOnly, but the server can read it. With no cookie the user is a guest.
  if (!request.cookies.has("session")) return NextResponse.json(null, { headers: noStore });

  let response: Response;
  try {
    response = await fetch(`${backendUrl}/api/me`, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { detail: "Cannot reach the server. Check your connection.", code: "network_error" },
      { status: 502, headers: noStore },
    );
  }

  // An expired or invalid cookie is also "not signed in".
  if (response.status === 401) return NextResponse.json(null, { headers: noStore });

  return new NextResponse(response.body, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("content-type") ?? "application/json", ...noStore },
  });
}
