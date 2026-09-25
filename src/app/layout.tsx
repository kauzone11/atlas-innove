import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
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
