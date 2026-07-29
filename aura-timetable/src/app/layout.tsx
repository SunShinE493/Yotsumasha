import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TimetableProvider } from "@/lib/store";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import AuthProvider from "@/components/AuthProvider";
import AutoSync from "@/components/AutoSync";

export const metadata: Metadata = {
  title: "Aura Timetable — 時間割管理",
  description: "美しく軽量な時間割管理PWA。Google Calendar連携とAIスナップショット機能搭載。",
  manifest: "/aura/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Aura Timetable",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0d0f1a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <link rel="apple-touch-icon" href="/aura/icon-192.png" />
      </head>
      <body>
        <ServiceWorkerRegistrar />
        <AuthProvider>
          <TimetableProvider>
            <AutoSync />
            {children}
          </TimetableProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
