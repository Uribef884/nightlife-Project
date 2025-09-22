'use client';

import React, { useState } from 'react';
import { useCart } from '@/hooks/useCart';
import { Plus, Minus } from 'lucide-react';

interface AddTicketToCartButtonProps {
  ticketId: string;
  date: string;
  maxPerPerson: number;
  price: number;
  name: string;
  category: 'general' | 'event' | 'free';
  className?: string;
  onAdd?: (quantity: number) => void;
}

export default function AddTicketToCartButton({
  ticketId,
  date,
  maxPerPerson,
  price,
  category,
  className = '',
  onAdd
}: AddTicketToCartButtonProps) {
  const { addTicket, getItemsByDate, updateItemQuantity } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Check if this ticket is already in cart for this date
  const existingItems = getItemsByDate(date);
  const existingTicket = existingItems.find(
    item => item.itemType === 'ticket' && item.ticketId === ticketId
  );
  const currentQuantity = existingTicket?.quantity || 0;

  const handleAddToCart = async () => {
    if (quantity <= 0) return;

    setIsLoading(true);
    try {
      if (existingTicket) {
        // Update existing item
        const newQuantity = currentQuantity + quantity;
        if (newQuantity > maxPerPerson) {
          alert(`No puedes agregar más de ${maxPerPerson} tickets por persona`);
          return;
        }
        await updateItemQuantity(existingTicket.id, newQuantity);
      } else {
        // Add new item
        const result = await addTicket(ticketId, date, quantity);
        if (!result.success) {
          alert(result.error || 'Error al agregar al carrito');
          return;
        }
      }

      if (onAdd) {
        onAdd(quantity);
      }
    } catch (error) {
      console.error('Error adding ticket to cart:', error);
      alert('Error al agregar al carrito');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getCategoryColor = () => {
    switch (category) {
      case 'general':
        return 'bg-blue-600 hover:bg-blue-700';
      case 'event':
        return 'bg-purple-600 hover:bg-purple-700';
      case 'free':
        return 'bg-green-600 hover:bg-green-700';
      default:
        return 'bg-blue-600 hover:bg-blue-700';
    }
  };

  const getCategoryText = () => {
    switch (category) {
      case 'general':
        return 'General';
      case 'event':
        return 'Evento';
      case 'free':
        return 'Gratis';
      default:
        return 'Ticket';
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Price and Category */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold text-slate-100">
            {formatPrice(price)}
          </p>
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            category === 'general' ? 'bg-blue-900/50 text-blue-300 border border-blue-700/50' :
            category === 'event' ? 'bg-purple-900/50 text-purple-300 border border-purple-700/50' :
            'bg-green-900/50 text-green-300 border border-green-700/50'
          }`}>
            {getCategoryText()}
          </span>
        </div>
      </div>

      {/* Quantity Selector */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                className="p-1 rounded-full hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Minus className="h-4 w-4 text-slate-300" />
              </button>
          
          <span className="text-lg font-medium text-slate-100 min-w-[2rem] text-center">
            {quantity}
          </span>
          
          <button
            onClick={() => setQuantity(Math.min(maxPerPerson, quantity + 1))}
            disabled={quantity >= maxPerPerson}
            className="p-1 rounded-full hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4 text-slate-300" />
          </button>
        </div>

        <div className="text-sm text-slate-400">
          Máx. {maxPerPerson} por persona
        </div>
      </div>

      {/* Add to Cart Button */}
      <button
        onClick={handleAddToCart}
        disabled={isLoading || quantity <= 0}
        className={`w-full ${getCategoryColor()} text-white py-3 px-4 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2`}
      >
        {isLoading ? (
          <>
            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Agregando...</span>
          </>
        ) : (
          <>
            <Plus className="h-4 w-4" />
            <span>
              {existingTicket ? 'Actualizar en Carrito' : 'Agregar al Carrito'}
            </span>
          </>
        )}
      </button>

      {/* Current Cart Quantity */}
      {currentQuantity > 0 && (
        <p className="text-sm text-green-400 text-center">
          {currentQuantity} en el carrito
        </p>
      )}
    </div>
  );
}
