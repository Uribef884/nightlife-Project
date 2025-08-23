import "./globals.css";
import type { Metadata } from "next";
import NavBar from "@/components/layout/NavBar";
import Footer from "@/components/layout/Footer";
import { Providers } from "./providers";
import { Quicksand } from "next/font/google";
import RouteTransitions from "@/components/common/RouteTransitions"; // client wrapper

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
    <html lang="es" className={quicksand.variable}>
      <body className="min-h-screen bg-slate-900 text-slate-100 antialiased font-sans">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <NavBar />
            <main className="mx-auto w-full max-w-6xl px-4 py-6 flex-1">
              {/* Smooth route-to-route transitions (pages) */}
              <RouteTransitions>{children}</RouteTransitions>
            </main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
