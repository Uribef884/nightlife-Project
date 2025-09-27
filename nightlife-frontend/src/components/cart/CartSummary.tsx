'use client';

import React from 'react';
import { useCartStore } from '@/stores/cart.store';
import { ShoppingCart } from 'lucide-react';

// Local type definitions for window cart summaries
type UnifiedSummary = {
  total?: number;
  operationalCosts?: number;
  actualTotal?: number;
};

type WindowCartSummaries = {
  unified?: UnifiedSummary;
};

interface CartSummaryProps {
  onCheckout?: () => void;
  showCheckoutButton?: boolean;
  className?: string;
}

export default function CartSummary({ 
  onCheckout, 
  showCheckoutButton = true,
  className = ''
}: CartSummaryProps) {
  const { getCartSummary, isLoading } = useCartStore();
  const summary = getCartSummary();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  if (!summary) {
    return (
      <div className={`bg-slate-800/50 rounded-lg p-6 text-center border border-slate-700/60 ${className}`}>
        <ShoppingCart className="h-12 w-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-100 mb-2">
          Tu carrito está vacío
        </h3>
        <p className="text-slate-400">
          Agrega tickets o elementos del menú para comenzar
        </p>
      </div>
    );
  }

  // Silently handle errors - don't show invasive alerts

  return (
    <div className={`bg-slate-800/50 border border-slate-700/60 rounded-lg ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700/60">
        <h3 className="text-lg font-medium text-slate-100">
          Resumen del Carrito
        </h3>
        <p className="text-sm text-slate-400">
          {summary.itemCount} {summary.itemCount === 1 ? 'artículo' : 'artículos'}
        </p>
      </div>

      {/* Items Summary */}
      <div className="px-6 py-4 space-y-3">
        {/* Use unified cart summary from backend if available (exactly like test-cart.html) */}
        {(() => {
          // Check for unified summary in window (like test-cart.html does)
          const windowSummaries = typeof window !== 'undefined' ? (window as unknown as { cartSummaries?: WindowCartSummaries }).cartSummaries : null;
          const unifiedSummary = windowSummaries?.unified;
          
          if (unifiedSummary) {
            // Use unified cart summary (exactly like test-cart.html)
            return (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-300">Costo de productos</span>
                  <span className="text-slate-100">{formatPrice(unifiedSummary.total || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-300">Tarifa de servicio</span>
                  <span className="text-slate-100">{formatPrice(unifiedSummary.operationalCosts || 0)}</span>
                </div>
                <div className="flex justify-between text-base font-medium border-t border-slate-700/60 pt-2">
                  <span className="text-slate-100">Total</span>
                  <span className="text-slate-100">{formatPrice(unifiedSummary.actualTotal || 0)}</span>
                </div>
              </div>
            );
          } else {
            // Fallback to simple total (like test-cart.html fallback)
            return (
              <div className="flex justify-between text-base font-medium">
                <span className="text-slate-100">Total</span>
                <span className="text-slate-100">{formatPrice(summary.totalSubtotal)}</span>
              </div>
            );
          }
        })()}
      </div>

      {/* Checkout Button */}
      {showCheckoutButton && (
        <div className="px-6 py-4 border-t border-slate-700/60">
          <button
            onClick={onCheckout}
            disabled={isLoading}
            className="w-full text-white py-3 px-4 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-violet-600 hover:bg-violet-500"
          >
            {isLoading ? 'Procesando...' : 'Completar Compra'}
          </button>
        </div>
      )}
    </div>
  );
}
