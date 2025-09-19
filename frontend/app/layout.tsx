import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { NotificationProvider } from "@/components/NotificationSystem";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "spawn.fun - Launch Tokens on Somnia",
  description: "The fastest token launch pad on Somnia Network. Create, trade, and discover tokens with ultra-low fees and instant transactions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} antialiased`}
      >
        <NotificationProvider>
          {children}
        </NotificationProvider>
      </body>
    </html>
  );
}
