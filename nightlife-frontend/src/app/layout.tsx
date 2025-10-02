import "./globals.css";
import type { Metadata } from "next";
import NavBar from "@/components/layout/NavBar";
import Footer from "@/components/layout/Footer";
import { Providers } from "./providers";
import { Quicksand } from "next/font/google";
import RouteTransitions from "@/components/common/RouteTransitions"; // client wrapper
import { GlobalModal } from "@/components/ui/GlobalModal";

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
    <html lang="es" className={quicksand.variable} data-scroll-behavior="smooth">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Suppress passive event listener warnings from Google Maps
              // These warnings are expected from third-party libraries and can't be controlled
              const originalError = console.error;
              console.error = function(...args) {
                const message = args[0];
                if (typeof message === 'string' && 
                    message.includes('Added non-passive event listener to a scroll-blocking')) {
                  return; // Suppress this specific warning
                }
                originalError.apply(console, args);
              };
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-slate-900 text-slate-100 antialiased font-sans">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <NavBar />
            <main className="flex-1">
              {/* Smooth route-to-route transitions (pages) */}
              <RouteTransitions>{children}</RouteTransitions>
            </main>
            <Footer />
          </div>
          <GlobalModal />
        </Providers>
      </body>
    </html>
  );
}
