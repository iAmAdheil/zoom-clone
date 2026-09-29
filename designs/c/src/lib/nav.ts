import type { IconName } from "@/components/ui/Icon";

export type NavItem = {
  label: string;
  icon: IconName;
  href: string | null; // null = placeholder, not built in this mockup
};

export const primaryNav: NavItem[] = [
  { label: "Home", icon: "home", href: "/" },
  { label: "Join", icon: "userPlus", href: "/join" },
  { label: "Schedule", icon: "calendar", href: "/schedule" },
  { label: "Recordings", icon: "recording", href: null },
  { label: "Contacts", icon: "contacts", href: null },
];

export const secondaryNav: NavItem[] = [{ label: "Settings", icon: "settings", href: null }];

// Phone tab bar: the four actions people use most.
export const tabNav: NavItem[] = [
  { label: "Home", icon: "home", href: "/" },
  { label: "Join", icon: "userPlus", href: "/join" },
  { label: "Schedule", icon: "calendar", href: "/schedule" },
  { label: "Settings", icon: "settings", href: null },
];
