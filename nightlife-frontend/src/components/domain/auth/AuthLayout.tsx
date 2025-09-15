'use client';

import Link from 'next/link';
import { AnimatePresence, motion, type Transition } from 'framer-motion';
import { AuthTabs } from './AuthTabs';

type Tab = 'login' | 'register';

/**
 * Auth shell:
 * - Tabs + headline pill
 * - Animated body keyed by the active TAB (no route jump)
 * - "Saltar por ahora → /" on the right
 *
 * iOS / Safari notes:
 * - Use 100svh so the initial render matches the *visible* height (prevents hidden tabs on first paint)
 * - Respect safe areas to avoid pushing UI down with generic padding
 * - Contain overscroll so the page doesn’t bounce into a partially scrolled state
 */
export default function AuthLayout({
  title,
  children,
  showSkip = false,
  skipHref = '/',
  activeTab = 'login',
  onTabChange,
}: {
  title: string;
  children: React.ReactNode;
  showSkip?: boolean;
  skipHref?: string;
  activeTab?: Tab;
  onTabChange?: (tab: Tab) => void;
}) {
  const variants = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -12 },
  };
  const transition: Transition = { type: 'spring', stiffness: 420, damping: 32, mass: 0.9 };

  return (
    <div className="min-h-[100svh] overscroll-contain flex items-start justify-center bg-[#07071a] px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-xl py-8 sm:py-12">
        {/* Tabs */}
        <div className="flex items-end justify-between">
          <div className="flex-1">
            <AuthTabs current={activeTab} onChange={onTabChange} />
          </div>
        </div>

        {/* Headline pill (reduced margin on small screens) */}
        <div className="mt-6 sm:mt-10 flex justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={transition}
            className="rounded-full bg-purple-600/90 px-6 py-3 text-white font-semibold shadow-sm"
          >
            {title}
          </motion.div>
        </div>

        {/* Skip link - below the pill, right side */}
        {showSkip && (
          <div className="mt-4 flex justify-end">
            <Link
              href={skipHref}
              className="text-sm text-purple-200 hover:text-purple-100 underline underline-offset-4"
              prefetch={false}
            >
              Saltar por ahora <span aria-hidden>↗</span>
            </Link>
          </div>
        )}

        {/* Animated content keyed by TAB so it doesn’t jump */}
        <div className="mt-6 sm:mt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={transition}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
