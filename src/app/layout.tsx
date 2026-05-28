import "./globals.css";
import type { Metadata, Viewport } from "next";
import SWRegister from "./sw-register";
import { ToastProvider } from "@/components/ui/Toast";
import BottomNavVisibility from "@/components/BottomNavVisibility";
import AppLaunchSplash from "@/components/AppLaunchSplash";

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
    <html
      lang="es"
      suppressHydrationWarning
      className="sp-root-dark"
      style={
  {
    background: "#0B0F19",
    "--sp-bottom-nav-height": "74px",
    "--sp-bottom-nav-offset": "6px",
    "--sp-bottom-safe":
      "calc(var(--sp-bottom-nav-height) + var(--sp-bottom-nav-offset) + env(safe-area-inset-bottom))",
  } as React.CSSProperties & Record<`--${string}`, string>
}
    >
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="theme-color" content="#0B0F19" />
        <meta name="color-scheme" content="dark" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <style
          dangerouslySetInnerHTML={{
            __html:
              "html,body{margin:0;min-height:100%;background:#050816!important;color:#E5E7EB;color-scheme:dark;}body{background:#050816!important;}#syncplans-boot-bg{position:fixed;inset:0;z-index:-1;background:radial-gradient(900px 420px at 20% -10%,rgba(56,189,248,.18),transparent 60%),radial-gradient(700px 380px at 90% 10%,rgba(124,58,237,.14),transparent 60%),#050816;}",
          }}
        />
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
          margin: 0,
        }}
      >
        <div id="syncplans-boot-bg" aria-hidden="true" />
        <SWRegister />
        <AppLaunchSplash />
        <ToastProvider>
          <div
            style={{
              minHeight: "100dvh",
              boxSizing: "border-box",
            }}
          >
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