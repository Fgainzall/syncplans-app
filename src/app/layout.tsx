import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "SyncPlans",
  description:
    "El calendario que evita discusiones innecesarias cuando compartes tu tiempo.",

  manifest: "/manifest.webmanifest",

  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png" }],
  },

  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SyncPlans",
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
    <html lang="es">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}