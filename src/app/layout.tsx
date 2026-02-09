// src/app/layout.tsx
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      {/* 
        Dejamos que globals.css controle el fondo y el color de texto.
        Así todo el app respeta la paleta más suave para Ara.
      */}
      <body className="min-h-screen">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
