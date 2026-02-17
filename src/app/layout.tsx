import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "SyncPlans",
  description:
    "El calendario que evita discusiones innecesarias cuando compartes tu tiempo.",
  icons: {
    icon: "/favicon.ico",
  },
  manifest: "/manifest.webmanifest", // 👈 ESTO ES CLAVE
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