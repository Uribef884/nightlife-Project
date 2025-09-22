'use client';

import { useState } from 'react';
import { X, AlertTriangle, Building2 } from 'lucide-react';

interface CartClubChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearCart: () => void;
  currentClubName?: string;
  newClubName?: string;
}

export function CartClubChangeModal({
  isOpen,
  onClose,
  onClearCart,
  currentClubName = "el club actual",
  newClubName = "este club",
}: CartClubChangeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-slate-900 border border-slate-700 rounded-lg p-6 mx-4 max-w-md w-full">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 bg-white rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
          aria-label="Cerrar modal"
        >
          <span className="text-black text-lg font-bold">×</span>
        </button>

        {/* Icon and title */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
            <Building2 className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-100">
              Cambio de club no permitido
            </h3>
            <p className="text-sm text-slate-400">
              Tienes elementos de otro club
            </p>
          </div>
        </div>

        {/* Message */}
        <div className="mb-6">
          <p className="text-slate-200 leading-relaxed">
            Tienes elementos en tu carrito de <strong>{currentClubName}</strong>. 
            Para agregar elementos de <strong>{newClubName}</strong>, primero vacía tu carrito.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={onClearCart}
            className="w-full bg-transparent hover:bg-slate-800/50 text-slate-400 hover:text-slate-200 font-medium py-2 px-4 rounded-md transition-colors"
          >
            Vaciar carrito
          </button>
          
          <button
            onClick={onClose}
            className="w-full bg-violet-600 hover:bg-violet-500 text-white font-medium py-3 px-4 rounded-md transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
