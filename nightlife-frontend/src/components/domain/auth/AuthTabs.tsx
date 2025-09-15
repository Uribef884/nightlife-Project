// src/components/auth/AuthTabs.tsx
'use client';

import { useEffect, useState } from 'react';
import { motion, type Transition } from 'framer-motion';

type Tab = 'login' | 'register';

type Props = {
  /** Optional controlled mode. If omitted, follows the URL hash (#login | #register). */
  current?: Tab;
  onChange?: (t: Tab) => void;
};

/** Read the desired tab from the URL hash; default to 'login'. */
function readTabFromUrl(): Tab {
  const h = (window.location.hash || '').replace('#', '').toLowerCase();
  return (h === 'login' || h === 'register' ? h : 'login') as Tab;
}

/**
 * Tabs UI:
 * - Active: RED text + animated PURPLE underline (shared layoutId)
 * - Inactive: softer purple
 */
export function AuthTabs({ current, onChange }: Props) {
  const [active, setActive] = useState<Tab>('login');

  // Controlled mode
  useEffect(() => {
    if (current) setActive(current);
  }, [current]);

  // Uncontrolled mode (fallback to hash)
  useEffect(() => {
    if (current !== undefined) return; // parent controls it
    const apply = () => setActive(readTabFromUrl());
    apply();
    const onHash = () => setActive(readTabFromUrl());
    const onPop = () => setActive(readTabFromUrl());
    window.addEventListener('hashchange', onHash);
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('popstate', onPop);
    };
  }, [current]);

  const handleChange = (t: Tab) => {
    if (typeof window !== 'undefined' && window.location.hash !== `#${t}`) {
      window.location.hash = t;
    }
    onChange?.(t);
    if (current !== undefined) setActive(t);
    // Scroll to top when switching tabs
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'login', label: 'Iniciar Sesión' },
    { key: 'register', label: 'Regístrate' },
  ];

  const underlineTransition: Transition = { type: 'spring', stiffness: 360, damping: 30 };

  return (
    <nav
      className="w-full p-0 flex items-center justify-start gap-6"
      role="tablist"
      aria-orientation="horizontal"
      aria-label="Opciones de autenticación"
    >
      <div className="relative flex items-center gap-6">
        {tabs.map((t) => {
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              tabIndex={-1}
              onClick={() => handleChange(t.key)}
              className={[
                'relative pb-2 text-lg font-semibold transition-colors',
                isActive ? 'text-red-500' : 'text-purple-300 hover:text-purple-200',
              ].join(' ')}
            >
              {t.label}
              {isActive && (
                <motion.div
                  layoutId="auth-underline"
                  transition={underlineTransition}
                  className="absolute left-0 right-0 -bottom-2 h-1 rounded-full bg-purple-500"
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default AuthTabs;
