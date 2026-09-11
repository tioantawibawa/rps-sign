import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "RPS Sign — Pengesahan & Tanda Tangan Digital RPS",
    template: "%s · RPS Sign",
  },
  description:
    "Sistem pengesahan dan persetujuan digital internal untuk Rencana Pembelajaran Semester (RPS).",
  applicationName: "RPS Sign",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#075E9B",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{ duration: 4000 }}
        />
      </body>
    </html>
  );
}
