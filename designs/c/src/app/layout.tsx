import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Zoom clone · Design C",
    template: "%s · Zoom clone",
  },
  description: "Static mockup of a Zoom-like web app. Design C.",
};

export const viewport: Viewport = {
  themeColor: "#0b5cff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <a
          href="#main"
          className="sr-only rounded-md bg-brand px-4 py-2 text-sm font-semibold text-on-brand focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
