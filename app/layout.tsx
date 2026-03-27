import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ScanProvider } from "@/lib/ScanContext";
import ToastContainer from "@/app/components/ToastContainer";

const geistSans = localFont({
  src: "../public/fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  fallback: ["system-ui", "sans-serif"],
});

const geistMono = localFont({
  src: "../public/fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  fallback: ["ui-monospace", "monospace"],
});

export const metadata: Metadata = {
  title: "Financial Decision Machine",
  description: "Analyze tickers using multi-agent AI and persist decisions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ScanProvider>
          {children}
          <ToastContainer />
        </ScanProvider>
      </body>
    </html>
  );
}
