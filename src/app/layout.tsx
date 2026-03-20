import "./globals.css";
import type { Metadata, Viewport } from "next";
import SWRegister from "./sw-register";
import { ToastProvider } from "@/components/ui/Toast";
import BottomNavVisibility from "@/components/BottomNavVisibility";

export const metadata: Metadata = {
  title: "SyncPlans",
  description:
    "El calendario que evita discusiones innecesarias cuando compartes tu tiempo.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0F19",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" style={{ background: "#0B0F19" }}>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="theme-color" content="#0B0F19" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
      </head>

      <body
        style={{
          minHeight: "100dvh",
          background: "#0B0F19",
          color: "#E5E7EB",
        }}
      >
        <SWRegister />
        <ToastProvider>
          <div style={{ paddingBottom: "calc(96px + env(safe-area-inset-bottom))" }}>
            {children}
          </div>

          <div className="md:hidden">
            <BottomNavVisibility />
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}