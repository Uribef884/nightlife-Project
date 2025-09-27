'use client';

import React, { useEffect, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Cart from './Cart';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckout?: () => void;
}

export default function CartDrawer({ isOpen, onClose, onCheckout }: CartDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Block body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      // Store the current scroll position
      const scrollY = window.scrollY;
      
      // Apply styles to prevent scrolling
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      
      return () => {
        // Restore scroll position and remove styles
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  // Handle ESC key to close drawer
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Handle global touch events for mobile
  useEffect(() => {
    const handleGlobalTouch = (event: TouchEvent) => {
      if (!isOpen) return;
      
      // Check if touch is outside the drawer
      const drawer = document.querySelector('[data-cart-drawer]');
      if (drawer && !drawer.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('touchend', handleGlobalTouch, { passive: true });
      return () => document.removeEventListener('touchend', handleGlobalTouch);
    }
  }, [isOpen, onClose]);

  const handleCheckout = () => {
    onClose();
    if (onCheckout) {
      onCheckout();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleBackdropTouch = () => {
    // Close on touch end - this should work reliably
    onClose();
  };

  const handleBackdropTouchStart = (e: React.TouchEvent) => {
    // Prevent default touch behaviors
    e.preventDefault();
  };

  const handleBackdropTouchMove = (e: React.TouchEvent) => {
    // Prevent scrolling during touch move
    e.preventDefault();
  };

  if (!mounted) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] overflow-hidden">
          {/* Backdrop - covers entire screen */}
          <motion.div 
            ref={backdropRef}
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={handleBackdropClick}
            onTouchStart={handleBackdropTouchStart}
            onTouchMove={handleBackdropTouchMove}
            onTouchEnd={handleBackdropTouch}
            onTouchCancel={handleBackdropTouch} // Also handle touch cancel
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ 
              touchAction: 'none', // Prevent default touch behaviors
              WebkitTouchCallout: 'none', // Prevent iOS callout
              WebkitUserSelect: 'none', // Prevent text selection
              userSelect: 'none'
            }}
          />
          
          {/* Drawer */}
          <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
            <div className="pointer-events-auto w-screen max-w-md">
              <motion.div 
                data-cart-drawer
                className="flex h-full flex-col bg-slate-900 shadow-xl"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ 
                  type: "spring", 
                  damping: 30, 
                  stiffness: 300,
                  duration: 0.3 
                }}
                onClick={(e) => e.stopPropagation()} // Prevent drawer clicks from closing
                onTouchStart={(e) => e.stopPropagation()} // Prevent drawer touches from closing
                onTouchEnd={(e) => e.stopPropagation()} // Prevent drawer touches from closing
              >
                {/* Header */}
                <div className="flex-shrink-0 px-4 py-6 sm:px-6 border-b border-slate-700/60">
                  <div className="flex items-start justify-between">
                    <h2 className="text-lg font-medium text-slate-100">
                      Carrito de Compras
                    </h2>
                    <div className="ml-3 flex h-7 items-center">
                      <button
                        type="button"
                        className="w-8 h-8 bg-white rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
                        onClick={onClose}
                      >
                        <span className="sr-only">Cerrar panel</span>
                        <span className="text-black text-lg font-bold">×</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Cart Content - Scrollable */}
                <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
                  <Cart onCheckout={handleCheckout} showSummary={true} />
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
