import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-[#050816] text-white">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
