import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { UtilityMenu } from "@/components/navigation/UtilityMenu";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Orbit", template: "%s · Orbit" },
  description: "A calm, personal orchestration experience centered on you.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f4ee" },
    { media: "(prefers-color-scheme: dark)", color: "#181816" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <header className="site-header">
          <Link className="wordmark" href="/" aria-label="Orbit home">
            <span className="wordmark-dot" aria-hidden="true" />
            Orbit
          </Link>
          <UtilityMenu
            showPresenceLab={process.env.NODE_ENV !== "production"}
          />
        </header>
        {children}
      </body>
    </html>
  );
}
