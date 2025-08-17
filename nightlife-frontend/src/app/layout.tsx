// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import NavBar from "@/components/layout/NavBar";
import Footer from "@/components/layout/Footer"; // 👈 add
import { Providers } from "./providers";
import { Quicksand } from "next/font/google";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Apply the font variable on <html> and use Tailwind's font-sans on body
    <html lang="es" className={quicksand.variable}>
      <body className="min-h-screen bg-slate-900 text-slate-100 antialiased font-sans">
        <Providers>
          {/* Flex column so the footer sits at the bottom */}
          <div className="flex min-h-screen flex-col">
            <NavBar />
            <main className="mx-auto w-full max-w-6xl px-4 py-6 flex-1">
              {children}
            </main>
            <Footer /> {/* 👈 added */}
          </div>
        </Providers>
      </body>
    </html>
  );
}

// Load Quicksand with a CSS variable
const quicksand = Quicksand({
  subsets: ["latin"],
  variable: "--font-quicksand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NightLife",
  description: "Tickets, events, and menus for nightclubs.",
};
