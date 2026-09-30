// Helpers for the `next` parameter of /signin. Server and client code both use them.

// Control characters (0x00-0x1F, 0x7F-0x9F) and all Unicode white space. A browser removes tab,
// CR and LF from a URL, so "/\t/evil.example" becomes "//evil.example". We remove them first.
const HIDDEN = /[\p{Cc}\p{Z}\s]/gu;

/** True when `path` is a path on this site: one leading "/", no "//", no "\", no "://". */
function isLocalPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") && !path.includes("://");
}

/**
 * Keeps a `next` value only when it is a path on this site ("/schedule", "/j/123").
 * This blocks open redirects such as "//evil.example", "/\evil.example", "/%09/evil.example"
 * and "https://evil.example". Any other value gives "/".
 */
export function safeNext(value: string | string[] | null | undefined): string {
  if (typeof value !== "string") return "/";
  const cleaned = value.replace(HIDDEN, "");
  if (!isLocalPath(cleaned)) return "/";
  // Check the decoded text too, so "/%2F/evil.example" and "/%5Cevil.example" fail as well.
  let decoded: string;
  try {
    decoded = decodeURIComponent(cleaned).replace(HIDDEN, "");
  } catch {
    return "/";
  }
  return isLocalPath(decoded) ? cleaned : "/";
}

/** /signin URL that brings the user back to `next` after sign in. */
export function signInHref(next: string): string {
  return `/signin?next=${encodeURIComponent(safeNext(next))}`;
}
