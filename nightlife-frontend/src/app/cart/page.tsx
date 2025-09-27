'use client';

import React from 'react';
import { Cart } from '@/components/cart';
import { useRouter } from 'next/navigation';

export default function CartPage() {
  const router = useRouter();

  const handleCheckout = () => {
    // Navigate to checkout page
    router.push('/checkout');
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-3xl mx-auto">
          <Cart onCheckout={handleCheckout} />
        </div>
      </div>
    </div>
  );
}
