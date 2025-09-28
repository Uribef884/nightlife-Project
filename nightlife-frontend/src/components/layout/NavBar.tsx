// src/components/layout/NavBar.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LogIn, User, Menu } from "lucide-react";
import { ClubTabs } from "@/components/domain/club/ClubTabs";
import { useAuthStore } from "@/stores/auth.store";
import { saveRedirectPath } from "@/utils/redirect";
import { scrollToTop } from "@/utils/scrollUtils";
import { CartButton, CartDrawer } from "@/components/cart";

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
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const { isAuthenticated, user } = useAuthStore();

  const pathname = usePathname() || "/";
  const isClubRoute = pathname.startsWith("/clubs/");
  const isAuthRoute = pathname.startsWith("/auth/") || pathname === "/auth";
  const isClubOwner = user?.role === 'clubowner';
  const isClubOwnerDashboard = pathname.startsWith("/dashboard/club-owner");

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
    if (typeof window !== "undefined") {
      // Scroll to top immediately when clicking tabs
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.location.hash = t;
      
      // Additional scroll attempts to override any interfering components
      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 100);
      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 300);
    }
  };

  const row1 = [
    "mx-auto flex items-center justify-between px-4",
    isClubRoute ? "max-w-5xl h-12 py-0" : "max-w-6xl py-3",
  ].join(" ");

  return (
    <>
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
          <Image src="/icon.svg" alt="NightLife" width={40} height={40} className="pointer-events-none" />
          <span className="text-xl font-semibold text-slate-100 pointer-events-none">NightLife</span>
        </Link>

        {/* Only show actions if not on auth routes */}
        {!isAuthRoute && (
          <div className="ml-auto flex items-center gap-2">
            {/* Desktop actions */}
            <div className="hidden items-center gap-3 md:flex">
              {/* Only show cart for non-club owners */}
              {!isClubOwner && (
                <CartButton
                  variant="icon"
                  size="md"
                  showCount={true}
                  onClick={() => setCartDrawerOpen(true)}
                  className="rounded-md border border-slate-700/60 p-2 text-slate-200 hover:bg-slate-800"
                />
              )}

              {isAuthenticated ? (
                !isClubOwner ? (
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500"
                  >
                    <User className="h-4 w-4" />
                    Ver Perfil
                  </Link>
                ) : (
                  !isClubOwnerDashboard && (
                    <Link
                      href="/dashboard/club-owner"
                      className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500"
                    >
                      <Menu className="h-4 w-4" />
                      Ir al Panel de Control
                    </Link>
                  )
                )
              ) : (
                <Link
                  href="/auth/login"
                  onClick={() => {
                    saveRedirectPath();
                    scrollToTop();
                  }}
                  className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500"
                >
                  <LogIn className="h-4 w-4" />
                  Iniciar Sesión
                </Link>
              )}
            </div>

            {/* Mobile buttons */}
            <div className="flex items-center gap-2 md:hidden">
              {/* Only show cart for non-club owners */}
              {!isClubOwner && (
                <CartButton
                  variant="icon"
                  size="md"
                  showCount={true}
                  onClick={() => setCartDrawerOpen(true)}
                  className="rounded-md border border-slate-700/60 p-2 text-slate-200 hover:bg-slate-800"
                />
              )}

              {isAuthenticated ? (
                !isClubOwner ? (
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center justify-center h-10 w-10 rounded-md bg-violet-600 text-white hover:bg-violet-500"
                    title="Ver Perfil"
                  >
                    <User className="h-5 w-5" />
                  </Link>
                ) : (
                  !isClubOwnerDashboard && (
                    <Link
                      href="/dashboard/club-owner"
                      className="inline-flex items-center justify-center h-10 w-10 rounded-md bg-violet-600 text-white hover:bg-violet-500"
                      title="Ir al Panel de Control"
                    >
                      <Menu className="h-5 w-5" />
                    </Link>
                  )
                )
              ) : (
                <Link
                  href="/auth/login"
                  onClick={() => {
                    saveRedirectPath();
                    scrollToTop();
                  }}
                  className="inline-flex items-center justify-center h-10 w-10 rounded-md bg-violet-600 text-white hover:bg-violet-500"
                  title="Iniciar Sesión"
                >
                  <LogIn className="h-5 w-5" />
                </Link>
              )}
            </div>
          </div>
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


      </header>
      
      {/* Cart Drawer - Outside header to avoid z-index issues - Only for non-club owners */}
      {!isClubOwner && (
        <CartDrawer
          isOpen={cartDrawerOpen}
          onClose={() => setCartDrawerOpen(false)}
          onCheckout={() => {
            setCartDrawerOpen(false);
            // Navigate to checkout page
            window.location.href = '/checkout';
          }}
        />
      )}
    </>
  );
}
