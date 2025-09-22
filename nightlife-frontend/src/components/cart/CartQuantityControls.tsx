'use client';

import React from 'react';
import { Minus, Plus } from 'lucide-react';

interface CartQuantityControlsProps {
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
  maxQuantity?: number;
  minQuantity?: number;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'compact' | 'minimal';
  className?: string;
}

export default function CartQuantityControls({
  quantity,
  onDecrease,
  onIncrease,
  maxQuantity = Infinity,
  minQuantity = 0,
  disabled = false,
  size = 'md',
  variant = 'default',
  className = '',
}: CartQuantityControlsProps) {
  const canDecrease = quantity > minQuantity && !disabled;
  const canIncrease = quantity < maxQuantity && !disabled;

  const sizeClasses = {
    sm: {
      button: 'h-6 w-6 text-xs',
      quantity: 'text-sm min-w-[1.5rem]',
      icon: 'h-3 w-3',
    },
    md: {
      button: 'h-8 w-8 text-sm',
      quantity: 'text-sm min-w-[2rem]',
      icon: 'h-4 w-4',
    },
    lg: {
      button: 'h-10 w-10 text-base',
      quantity: 'text-base min-w-[2.5rem]',
      icon: 'h-5 w-5',
    },
  };

  const variantClasses = {
    default: {
      button: 'rounded-full bg-white/10 hover:bg-white/20 text-white',
      buttonDisabled: 'bg-white/5 text-white/40 cursor-not-allowed',
      container: 'flex items-center gap-2',
      quantity: 'text-center font-semibold text-white/90',
    },
    compact: {
      button: 'rounded-md bg-white/10 hover:bg-white/15 text-white',
      buttonDisabled: 'bg-white/5 text-white/40 cursor-not-allowed',
      container: 'flex items-center gap-2 flex-wrap',
      quantity: 'text-center font-semibold text-white',
    },
    minimal: {
      button: 'rounded p-1 hover:bg-slate-700/50 text-slate-300',
      buttonDisabled: 'opacity-50 cursor-not-allowed',
      container: 'flex items-center space-x-2',
      quantity: 'text-sm font-medium text-slate-100 min-w-[2rem] text-center',
    },
  };

  const currentSize = sizeClasses[size];
  const currentVariant = variantClasses[variant];

  return (
    <div className={`${currentVariant.container} ${className}`}>
      <button
        type="button"
        onClick={onDecrease}
        disabled={!canDecrease}
        className={`
          ${currentSize.button} 
          ${currentVariant.button}
          ${!canDecrease ? currentVariant.buttonDisabled : ''}
          transition-colors duration-200
          flex items-center justify-center
        `}
        aria-label="Disminuir cantidad"
      >
        <Minus className={currentSize.icon} />
      </button>
      
      <div className={`${currentSize.quantity} ${currentVariant.quantity}`}>
        {quantity}
      </div>
      
      <button
        type="button"
        onClick={onIncrease}
        disabled={!canIncrease}
        className={`
          ${currentSize.button} 
          ${currentVariant.button}
          ${!canIncrease ? currentVariant.buttonDisabled : ''}
          transition-colors duration-200
          flex items-center justify-center
        `}
        aria-label="Aumentar cantidad"
      >
        <Plus className={currentSize.icon} />
      </button>
    </div>
  );
}
