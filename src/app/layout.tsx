import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import { DemoBar } from "@/components/chrome/DemoBar";
import "./globals.css";

const archivo = localFont({
  src: "./fonts/Archivo-Variable.woff2",
  variable: "--font-archivo",
  weight: "100 900",
  display: "swap",
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
});

const martian = localFont({
  src: "./fonts/MartianMono-Variable.woff2",
  variable: "--font-martian",
  weight: "100 800",
  display: "swap",
  declarations: [{ prop: "font-stretch", value: "75% 112.5%" }],
});

export const metadata: Metadata = {
  title: { default: "Your garage · South West Mechanical & 4x4", template: "%s · MyGarage" },
  description: "Your household's vehicles, service history and ones to watch, from your local workshop.",
  applicationName: "MyGarage",
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#1D4F66",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU" className={`${archivo.variable} ${martian.variable}`}>
      <body className="min-h-dvh">
        <Suspense fallback={<div className="no-print sticky top-0 z-40 h-11 bg-sump" aria-hidden="true" />}>
          <DemoBar />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
