import type { Metadata } from "next";
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
