'use client';

import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { useCartContext } from '@/contexts/CartContext';

interface CartIconButtonProps {
  variant?: 'icon' | 'text';
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  className?: string;
  onClick?: () => void;
}

export default function CartIconButton({
  variant = 'icon',
  size = 'md',
  showCount = true,
  className = '',
  onClick,
}: CartIconButtonProps) {
  const { itemCount } = useCartContext();

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  if (variant === 'text') {
    return (
      <button
        onClick={onClick}
        className={`flex items-center gap-2 text-left transition-colors duration-150 ${className}`}
      >
        <ShoppingCart className={iconSizes[size]} />
        <span className="font-medium">Carrito</span>
        {showCount && itemCount > 0 && (
          <span className="ml-auto rounded-full bg-violet-600 px-2 py-1 text-xs font-bold text-white">
            {itemCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`relative ${sizeClasses[size]} ${className}`}
      aria-label={`Carrito con ${itemCount} artículos`}
    >
      <ShoppingCart className={`${iconSizes[size]} text-slate-200`} />
      {showCount && itemCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      )}
    </button>
  );
}
