'use client';

import React, { useEffect, useState } from 'react';
import { useCartStore } from '@/stores/cart.store';
import CartItem from './CartItem';
import CartSummary from './CartSummary';
import { ShoppingCart, Ticket, Utensils } from 'lucide-react';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

interface CartProps {
  onCheckout?: () => void;
  showSummary?: boolean;
  className?: string;
}

export default function Cart({ 
  onCheckout, 
  showSummary = true,
  className = '' 
}: CartProps) {
  const { 
    items, 
    isLoading, 
    refreshCart, 
    clearCart,
    getCartSummary
  } = useCartStore();

  const [showClearModal, setShowClearModal] = useState(false);

  // Refresh cart on mount
  useEffect(() => {
    refreshCart();
  }, [refreshCart]);


  const getUniqueDates = () => {
    const dates = new Set(items.map(item => item.date));
    return Array.from(dates).sort();
  };

  const getItemsByTypeAndDate = (itemType: 'ticket' | 'menu', date: string) => {
    return items.filter(item => item.itemType === itemType && item.date === date);
  };

  // Check if this is a free checkout
  const cartSummary = getCartSummary();
  const isFreeCheckout = cartSummary ? (cartSummary.total === 0 || cartSummary.totalSubtotal === 0) : false;

  const handleClearCart = () => {
    setShowClearModal(true);
  };

  const confirmClearCart = async () => {
    await clearCart();
    setShowClearModal(false);
  };

  if (isLoading && items.length === 0) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Silently handle errors - don't show invasive alerts

  if (items.length === 0) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="bg-slate-800/50 rounded-lg p-8 text-center border border-slate-700/60">
          <ShoppingCart className="h-16 w-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-slate-100 mb-2">
            Tu carrito está vacío
          </h3>
          <p className="text-slate-400">
            Agrega tickets o elementos del menú para comenzar
          </p>
        </div>
      </div>
    );
  }

  const uniqueDates = getUniqueDates();

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-100">
          Ítems:
        </h2>
        {items.length > 0 && (
          <button
            onClick={handleClearCart}
            className="text-sm text-red-400 hover:text-red-300 underline whitespace-nowrap"
          >
            Vaciar carrito
          </button>
        )}
      </div>

      {/* Items by Date */}
      {uniqueDates.map(date => (
        <div key={date} className="space-y-4">

          {/* Tickets for this date */}
          {getItemsByTypeAndDate('ticket', date).length > 0 && (
            <div className="space-y-3">
              <h4 className="text-md font-medium text-slate-300 flex items-center">
                <Ticket className="h-4 w-4 mr-2" />
                Tickets
              </h4>
              <div className="space-y-3">
                {getItemsByTypeAndDate('ticket', date).map(item => (
                  <CartItem key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* Menu items for this date */}
          {getItemsByTypeAndDate('menu', date).length > 0 && (
            <div className="space-y-3">
              <h4 className="text-md font-medium text-slate-300 flex items-center">
                <Utensils className="h-4 w-4 mr-2" />
                Menú
              </h4>
              <div className="space-y-3">
                {getItemsByTypeAndDate('menu', date).map(item => (
                  <CartItem key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Summary */}
      {showSummary && <CartSummary onCheckout={onCheckout} isFreeCheckout={isFreeCheckout} />}

      {/* Clear Cart Confirmation Modal */}
      {showClearModal && (
        <ConfirmModal
          title="Vaciar carrito"
          body="¿Estás seguro de que quieres vaciar el carrito?"
          onClose={() => setShowClearModal(false)}
          onConfirm={confirmClearCart}
        />
      )}
    </div>
  );
}
