import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import Link from "next/link";
import { CartBadge } from "@/features/cart/cart-badge";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bike configurator",
  description:
    "Configure a bike with accessories and add the bundle to your cart.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-line bg-surface">
          <nav className="mx-auto flex max-w-6xl items-center justify-between p-4 sm:px-6">
            <Link href="/" className="font-semibold">
              Bike shop
            </Link>
            <Suspense fallback={<span className="text-sm">Cart</span>}>
              <CartBadge />
            </Suspense>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
