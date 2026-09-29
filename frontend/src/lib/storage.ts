// Safe wrappers for browser storage. Storage can throw (private mode, blocked site data),
// so every read and write is in try/catch, and the app works without storage.

type Area = "local" | "session";

function area(which: Area): Storage | null {
  try {
    return which === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readStorage(which: Area, key: string): string | null {
  try {
    return area(which)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStorage(which: Area, key: string, value: string | null): void {
  try {
    const store = area(which);
    if (value === null) store?.removeItem(key);
    else store?.setItem(key, value);
  } catch {
    // Storage is full or blocked. The value is only a convenience, so ignore the error.
  }
}

const NAME_KEY = "zc:display-name";

/** The display name from "Remember my name for future meetings". */
export const rememberedName = {
  read: () => readStorage("local", NAME_KEY) ?? "",
  write: (name: string) => writeStorage("local", NAME_KEY, name.trim() || null),
};
