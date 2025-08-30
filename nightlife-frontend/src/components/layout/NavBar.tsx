// src/components/layout/NavBar.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LogIn, ShoppingCart, Menu as MenuIcon, X, User } from "lucide-react";
import { ClubTabs } from "@/components/domain/club/ClubTabs";
import { useAuthStore } from "@/stores/auth.store";

type TabKey = "general" | "reservas" | "carta";

// Prefer #hash; fall back to ?tab= (accept en/es synonyms)
function resolveTabFromURL(): TabKey {
  if (typeof window === "undefined") return "general";
  const hash = window.location.hash.replace("#", "").toLowerCase();
  if (hash === "general" || hash === "reservas" || hash === "carta") return hash as TabKey;

  const sp = new URLSearchParams(window.location.search);
  const tab = (sp.get("tab") || "").toLowerCase();
  if (tab === "reservas" || tab === "reservations") return "reservas";
  if (tab === "carta" || tab === "menu") return "carta";
  return "general";
}

export default function NavBar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated } = useAuthStore();

  const pathname = usePathname() || "/";
  const isClubRoute = pathname.startsWith("/clubs/");
  const isAuthRoute = pathname.startsWith("/auth/") || pathname === "/auth";

  const [currentTab, setCurrentTab] = useState<TabKey>("general");

  // Sync with URL on mount + hash changes
  useEffect(() => {
    const read = () => setCurrentTab(resolveTabFromURL());
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  // Also re-read any time the route changes (e.g., Home -> Club)
  useEffect(() => {
    setCurrentTab(resolveTabFromURL());
  }, [pathname]);

  const onTabChange = (t: TabKey) => {
    if (typeof window !== "undefined") window.location.hash = t;
  };

  const row1 = [
    "mx-auto flex items-center justify-between px-4",
    isClubRoute ? "max-w-5xl h-12 py-0" : "max-w-6xl py-3",
  ].join(" ");

  return (
    <header
      id="app-navbar"
      role="banner"
      className="sticky top-0 z-40 w-full border-b border-slate-800/60 bg-slate-900/80 backdrop-blur"
    >
      {/* Row 1: brand + actions */}
      <div className={row1}>
        <Link
          href="/"
          className="flex items-center gap-1 sm:gap-2 hover:opacity-80 transition-opacity cursor-pointer"
          aria-label="Ir al inicio"
        >
          <img src="/icon.svg" alt="NightLife" width={40} height={40} className="pointer-events-none" />
          <span className="text-xl font-semibold text-slate-100 pointer-events-none">NightLife</span>
        </Link>

        {/* Only show actions if not on auth routes */}
        {!isAuthRoute && (
          <div className="hidden items-center gap-3 md:flex">
            <button
              aria-label="Abrir carrito"
              className="rounded-md border border-slate-700/60 p-2 text-slate-200 hover:bg-slate-800"
            >
              <ShoppingCart className="h-4 w-4" />
            </button>

            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500"
              >
                <User className="h-4 w-4" />
                Ver Perfil
              </Link>
            ) : (
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500"
              >
                <LogIn className="h-4 w-4" />
                Iniciar Sesión
              </Link>
            )}
          </div>
        )}

        {/* Only show mobile menu button if not on auth routes */}
        {!isAuthRoute && (
          <button
            className="rounded-md p-2 text-slate-200 hover:bg-slate-800 md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            aria-controls="mobile-menu"
            aria-expanded={mobileOpen}
          >
            <MenuIcon className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Row 2: tabs — transparent, centered; only on /clubs/* */}
      {isClubRoute && (
        <div className="bg-transparent">
          <div className="mx-auto max-w-5xl px-4 h-10 flex items-end justify-center">
            <ClubTabs current={currentTab} onChange={onTabChange} />
          </div>
        </div>
      )}

      {/* Mobile sheet - only show if not on auth routes */}
      {mobileOpen && !isAuthRoute && (
        <div id="mobile-menu" className="md:hidden" role="dialog" aria-modal="true" aria-label="Mobile menu">
          <div className="border-t border-slate-800/60 bg-slate-900 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-200 font-semibold">Menu</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-2 text-slate-200 hover:bg-slate-800"
                aria-label="Close menu"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-3 space-y-2">
              <button className="flex w-full items-center gap-2 rounded-md border border-slate-700/60 px-3 py-2 text-left text-slate-200 hover:bg-slate-800">
                <ShoppingCart className="h-4 w-4" />
                Carrito
              </button>

              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 rounded-md bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500"
                  onClick={() => setMobileOpen(false)}
                >
                  <User className="h-4 w-4" />
                  Ver Perfil
                </Link>
              ) : (
                <Link
                  href="/auth/login"
                  className="flex items-center gap-2 rounded-md bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500"
                  onClick={() => setMobileOpen(false)}
                >
                  <LogIn className="h-4 w-4" />
                  Iniciar Sesión
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
