'use client';

import React, { useState } from 'react';
import { useCart } from '@/hooks/useCart';
import { Plus, Minus } from 'lucide-react';

interface MenuItemVariant {
  id: string;
  name: string;
  price: number;
  maxPerPerson?: number;
}

interface AddMenuItemToCartButtonProps {
  menuItemId: string;
  name: string;
  price?: number;
  variants?: MenuItemVariant[];
  hasVariants: boolean;
  maxPerPerson?: number;
  date: string;
  className?: string;
  onAdd?: (quantity: number, variantId?: string) => void;
}

export default function AddMenuItemToCartButton({
  menuItemId,
  name,
  price,
  variants = [],
  hasVariants,
  maxPerPerson,
  date,
  className = '',
  onAdd
}: AddMenuItemToCartButtonProps) {
  const { addMenuItem, getItemsByDate, updateItemQuantity } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(
    hasVariants && variants.length > 0 ? variants[0].id : undefined
  );
  const [isLoading, setIsLoading] = useState(false);

  // Check if this menu item is already in cart for this date
  const existingItems = getItemsByDate(date);
  const existingMenuItem = existingItems.find(
    item => item.itemType === 'menu' && 
    item.menuItemId === menuItemId && 
    item.variantId === selectedVariantId
  );
  const currentQuantity = existingMenuItem?.quantity || 0;

  const selectedVariant = variants.find(v => v.id === selectedVariantId);
  const currentPrice = selectedVariant?.price || price || 0;
  const currentMaxPerPerson = selectedVariant?.maxPerPerson || maxPerPerson || 999;

  const handleAddToCart = async () => {
    if (quantity <= 0) return;

    setIsLoading(true);
    try {
      if (existingMenuItem) {
        // Update existing item
        const newQuantity = currentQuantity + quantity;
        if (newQuantity > currentMaxPerPerson) {
          alert(`No puedes agregar más de ${currentMaxPerPerson} por persona`);
          return;
        }
        await updateItemQuantity(existingMenuItem.id, newQuantity);
      } else {
        // Add new item
        const result = await addMenuItem(menuItemId, selectedVariantId, date, quantity);
        if (!result.success) {
          alert(result.error || 'Error al agregar al carrito');
          return;
        }
      }

      if (onAdd) {
        onAdd(quantity, selectedVariantId);
      }
    } catch (error) {
      console.error('Error adding menu item to cart:', error);
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

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Price */}
      <div className="flex items-center justify-between">
        <p className="text-2xl font-bold text-slate-100">
          {formatPrice(currentPrice)}
        </p>
      </div>

      {/* Variant Selection */}
      {hasVariants && variants.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">
            Seleccionar opción:
          </label>
          <div className="space-y-2">
            {variants.map((variant) => (
              <label key={variant.id} className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name={`variant-${menuItemId}`}
                  value={variant.id}
                  checked={selectedVariantId === variant.id}
                  onChange={(e) => setSelectedVariantId(e.target.value)}
                  className="h-4 w-4 text-violet-600 focus:ring-violet-500 border-slate-600 bg-slate-800"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-100">
                      {variant.name}
                    </span>
                    <span className="text-sm text-slate-400">
                      {formatPrice(variant.price)}
                    </span>
                  </div>
                  {variant.maxPerPerson && (
                    <p className="text-xs text-slate-400">
                      Máx. {variant.maxPerPerson} por persona
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

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
            onClick={() => setQuantity(Math.min(currentMaxPerPerson, quantity + 1))}
            disabled={quantity >= currentMaxPerPerson}
            className="p-1 rounded-full hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4 text-slate-300" />
          </button>
        </div>

        <div className="text-sm text-slate-400">
          Máx. {currentMaxPerPerson} por persona
        </div>
      </div>

      {/* Add to Cart Button */}
      <button
        onClick={handleAddToCart}
        disabled={isLoading || quantity <= 0 || (hasVariants && !selectedVariantId)}
        className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 px-4 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
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
              {existingMenuItem ? 'Actualizar en Carrito' : 'Agregar al Carrito'}
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
