import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "SFlow — Gestão de Mídia",
  description: "Plataforma profissional para gestão de clientes, mídia e financeiro. Multi-tenant SaaS.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/favicon-512-black.png", sizes: "512x512", type: "image/png", media: "(prefers-color-scheme: light)" },
      { url: "/icons/favicon-512-white.png", sizes: "512x512", type: "image/png", media: "(prefers-color-scheme: dark)" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/icon-192.png",
  },
  themeColor: "#6366f1",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Schumaker Flow",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head />
      <body>
        <script dangerouslySetInnerHTML={{
          __html: `
          (function() {
            var t = localStorage.getItem('theme');
            if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
              document.documentElement.setAttribute('data-theme', 'dark');
            }
          })();
        ` }} />
        {children}
      </body>
    </html>
  );
}
