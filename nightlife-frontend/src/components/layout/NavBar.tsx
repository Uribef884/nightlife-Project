"use client";

import Link from "next/link";
import { useState } from "react";
import { Globe2, LogIn, ShoppingCart, Menu as MenuIcon, X } from "lucide-react";

export default function NavBar() {
  const [langOpen, setLangOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/60 bg-slate-900/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-block h-7 w-7 rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-500" />
          <span className="text-lg font-semibold text-slate-100">NightLife</span>
        </Link>

        {/* Desktop actions */}
        <div className="hidden items-center gap-3 md:flex">
          {/* Language selector */}
          <div className="relative">
            <button
              className="flex items-center gap-1 rounded-md border border-slate-700/60 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
              onClick={() => setLangOpen((s) => !s)}
              aria-haspopup="listbox"
              aria-expanded={langOpen}
              aria-label="Change language"
            >
              <Globe2 className="h-4 w-4" />
              Español
            </button>
            {langOpen && (
              <div className="absolute right-0 mt-2 w-36 overflow-hidden rounded-md border border-slate-700/60 bg-slate-800 text-sm shadow-lg">
                <button className="block w-full px-3 py-2 text-left text-slate-200 hover:bg-slate-700">Español</button>
                <button className="block w-full px-3 py-2 text-left text-slate-200 hover:bg-slate-700">English</button>
              </div>
            )}
          </div>

          {/* Cart */}
          <button
            aria-label="Open cart"
            className="rounded-md border border-slate-700/60 p-2 text-slate-200 hover:bg-slate-800"
          >
            <ShoppingCart className="h-4 w-4" />
          </button>

          {/* Login */}
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500"
          >
            <LogIn className="h-4 w-4" />
            Login
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="rounded-md p-2 text-slate-200 hover:bg-slate-800 md:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          aria-controls="mobile-menu"
          aria-expanded={mobileOpen}
        >
          <MenuIcon className="h-6 w-6" />
        </button>
      </div>

      {/* Mobile sheet */}
      {mobileOpen && (
        <div
          id="mobile-menu"
          className="md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile menu"
        >
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
              <button
                className="flex w-full items-center gap-2 rounded-md border border-slate-700/60 px-3 py-2 text-left text-slate-200 hover:bg-slate-800"
                onClick={() => {
                  setLangOpen((s) => !s);
                }}
              >
                <Globe2 className="h-4 w-4" />
                Español
              </button>

              <button className="flex w-full items-center gap-2 rounded-md border border-slate-700/60 px-3 py-2 text-left text-slate-200 hover:bg-slate-800">
                <ShoppingCart className="h-4 w-4" />
                Cart
              </button>

              <Link
                href="/auth/login"
                className="flex items-center gap-2 rounded-md bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500"
                onClick={() => setMobileOpen(false)}
              >
                <LogIn className="h-4 w-4" />
                Login
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
