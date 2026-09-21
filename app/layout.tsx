import type { Metadata } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shipment Control Tower",
  description: "Real-time visibility of container shipments",
  icons: {
    icon: "https://ik.imagekit.io/6kafqkidx/logome.png",
  },
};

// This is a live operations dashboard — every page reads current
// shipment/alert/order-planning state from Supabase on every request.
// Without this, Next.js's Data Cache can silently cache the underlying
// fetch() calls Supabase makes even on a dynamically-rendered page (one
// using cookies()/headers(), as every page here does via getCurrentUser()
// in AppShell) — which is exactly what caused Alerts to show a stale
// "0 alerts" snapshot from before a real alert existed, while Overview
// (rendered in the same request cycle but hitting the cache differently)
// showed the live one. force-dynamic disables that caching app-wide.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-page text-text-primary">{children}</body>
    </html>
  );
}