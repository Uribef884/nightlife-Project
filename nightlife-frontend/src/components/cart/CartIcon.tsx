'use client';

import React from 'react';
import { useCartStore } from '@/stores/cart.store';
import { ShoppingCart } from 'lucide-react';
import Link from 'next/link';

interface CartIconProps {
  className?: string;
  showCount?: boolean;
  href?: string;
}

export default function CartIcon({ 
  className = '', 
  showCount = true,
  href = '/cart'
}: CartIconProps) {
  const { getItemCount, isLoading } = useCartStore();
  const itemCount = getItemCount();

  const content = (
    <div className={`relative ${className}`}>
      <ShoppingCart className="h-6 w-6 text-gray-600 hover:text-gray-900 transition-colors" />
      {showCount && itemCount > 0 && (
        <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      )}
      {isLoading && (
        <div className="absolute -top-2 -right-2 h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-block">
        {content}
      </Link>
    );
  }

  return content;
}
