import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import type { Metadata, Viewport } from "next";
import SWRegister from "./sw-register";

export const metadata: Metadata = {
  title: "SyncPlans",
  description:
    "El calendario que evita discusiones innecesarias cuando compartes tu tiempo.",
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
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="theme-color" content="#0B0F19" />
      </head>
      <body>
        <SWRegister />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}