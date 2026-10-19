import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { getAppBaseUrl } from "@/lib/app-base-url";

import "./globals.css";
import "@/components/media/media.css";

export const metadata: Metadata = {
  metadataBase: getAppBaseUrl(),
  title: {
    default: "Atlas Innove",
    template: "%s · Atlas Innove",
  },
  description: "Acompanhamento longitudinal de iniciativas apoiadas por inovação e financiamento.",
};

export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: "#ececf0" }, { media: "(prefers-color-scheme: dark)", color: "#0c0c0f" }] };

// Applies the stored (or system) theme before first paint to avoid a flash.
const themeScript = `try{var t=localStorage.getItem("atlas-theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
