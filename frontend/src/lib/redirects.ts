// Helpers for the `next` parameter of /signin. Server and client code both use them.

/**
 * Keeps a `next` value only when it is a path on this site ("/schedule", "/j/123").
 * This blocks open redirects such as "//evil.example" or "https://evil.example".
 */
export function safeNext(value: string | string[] | null | undefined): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}

/** /signin URL that brings the user back to `next` after sign in. */
export function signInHref(next: string): string {
  return `/signin?next=${encodeURIComponent(safeNext(next))}`;
}
