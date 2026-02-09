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
        Fondo y color de texto ahora vienen desde globals.css
        para poder usar una paleta más suave y consistente.
      */}
      <body className="min-h-screen">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
