import type { Metadata, Viewport } from "next";
import { DM_Sans, Instrument_Serif, Inter } from "next/font/google";
import "./globals.css";
import "./customer.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fixaro",
  description: "Fixaro — bookings, jobs, and crew workspace.",
  applicationName: "Fixaro",
  appleWebApp: {
    capable: true,
    title: "Fixaro",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#e85d04",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Lock the page from accidentally pinch-zooming, since installed PWA shouldn't behave like a web page.
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${instrumentSerif.variable} ${inter.variable}`}>
      <body className={`!font-dm-sans`} suppressHydrationWarning>{children}</body>
    </html>
  );
}
