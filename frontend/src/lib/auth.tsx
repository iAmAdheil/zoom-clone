"use client";

import { useRouter } from "next/navigation";
import { createContext, use, type ReactNode } from "react";
import { api } from "./api";
import { meetingStore } from "./meetingStore";
import { clearCache } from "./queries";
import type { User } from "./types";

/** Returns a function that signs out, forgets all cached data, and opens /signin. */
export function useSignOut() {
  const router = useRouter();
  return async function signOut() {
    try {
      await api.logout();
    } finally {
      router.replace("/signin");
      meetingStore.clearAll();
      await clearCache();
    }
  };
}

const UserContext = createContext<User | null>(null);

/** Gives the signed-in user to the portal pages. PortalShell renders it after /api/me succeeds. */
export function SignedInUserProvider({ user, children }: { user: User; children: ReactNode }) {
  return <UserContext value={user}>{children}</UserContext>;
}

/** The signed-in user on a protected page. Use it only below PortalShell. */
export function useUser(): User {
  const user = use(UserContext);
  if (!user) throw new Error("useUser() must be used inside PortalShell.");
  return user;
}
