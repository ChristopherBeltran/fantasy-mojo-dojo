import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "🏈 Fantasy Mojo Dojo",
  description: "Sleeper-synced standings, stats, and AI-tracked bonuses.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
