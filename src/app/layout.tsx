import type { Metadata, Viewport } from "next";
import { SiteNav } from "@/components/site-nav";
import { messages } from "@/messages/es";
import "./globals.css";

export const metadata: Metadata = {
  title: messages.app.title,
  description: messages.app.tagline,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
