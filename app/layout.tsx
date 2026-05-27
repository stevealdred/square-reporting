import type { Metadata } from "next";
import type { ReactNode } from "react";
import { themeBootstrapScript } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Square Advanced Reporting",
  description:
    "Build, run, and visualize queries against the Square Advanced Reporting API.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        {/*
         * Sync-evaluated before React hydrates so the page paints with the
         * user's stored / preferred theme — avoids a light/dark flash.
         */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
