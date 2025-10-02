'use client';

import React from 'react';
import { AlertTriangle, ShoppingCart, X } from 'lucide-react';

interface CartAgeWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearCart: () => void;
}

export function CartAgeWarningModal({
  isOpen,
  onClose,
  onClearCart
}: CartAgeWarningModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-slate-800 rounded-lg shadow-xl border border-slate-700 max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-orange-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-100">
                Tu carrito ha expirado
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-slate-300 text-center">
            Agrega los artículos nuevamente
          </p>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-slate-700">
          <button
            onClick={onClearCart}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition-colors"
          >
            <ShoppingCart className="h-4 w-4" />
            <span>Vaciar Carrito</span>
          </button>
        </div>
      </div>
    </div>
  );
}
