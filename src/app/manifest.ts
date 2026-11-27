import type { MetadataRoute } from "next";
import { messages } from "@/messages/es";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: messages.app.title,
    short_name: "Analizador",
    description: messages.app.tagline,
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ad7b4e",
    categories: ["games", "education"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
