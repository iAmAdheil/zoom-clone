import {
  CalendarDays,
  House,
  MessageCircle,
  PenLine,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Placeholder items are visible but not built in this mockup. */
  placeholder?: boolean;
};

export const navItems: NavItem[] = [
  { label: "Home", href: "/", icon: House },
  { label: "Meetings", href: "/schedule", icon: Video },
  { label: "Team Chat", href: "#", icon: MessageCircle, placeholder: true },
  { label: "Calendar", href: "#", icon: CalendarDays, placeholder: true },
  { label: "Whiteboards", href: "#", icon: PenLine, placeholder: true },
  { label: "Contacts", href: "#", icon: Users, placeholder: true },
];
