import type { Metadata, Viewport } from "next";
import { Pwa } from "@/components/pwa";
import { SiteNav } from "@/components/site-nav";
import { messages } from "@/messages/es";
import "./globals.css";

export const metadata: Metadata = {
  title: messages.app.title,
  description: messages.app.tagline,
  applicationName: messages.app.title,
  appleWebApp: { capable: true, title: "Analizador", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ad7b4e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <Pwa />
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
