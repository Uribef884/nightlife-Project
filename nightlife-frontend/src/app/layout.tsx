import "./globals.css";
import type { Metadata } from "next";
import NavBar from "@/components/layout/NavBar";
import { Providers } from "./providers";
import { Quicksand } from "next/font/google";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Apply the font variable on <html> and use Tailwind's font-sans on body
    <html lang="es" className={quicksand.variable}>
      <body className="min-h-screen bg-slate-900 text-slate-100 antialiased font-sans">
        <Providers>
          <NavBar />
          <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
