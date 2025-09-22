'use client';

import React, { useState } from 'react';
import { CartItem as CartItemType } from '@/services/cart.service';
import { useCartStore } from '@/stores/cart.store';
import { Minus, Plus, Trash2 } from 'lucide-react';

// 🔸 Same cocktail placeholder as used in MenuItemCard
const PLACEHOLDER_DATA_URL =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160' role='img' aria-label='Cocktail'>
      <defs>
        <radialGradient id='g' cx='0' cy='0' r='1' gradientUnits='userSpaceOnUse'
          gradientTransform='translate(80 60) rotate(90) scale(100)'>
          <stop offset='0' stop-color='#7A48D3' stop-opacity='.18'/>
          <stop offset='1' stop-color='#0B0F1A' stop-opacity='.88'/>
        </radialGradient>
      </defs>
      <rect x='6' y='6' width='148' height='148' rx='18' fill='url(#g)'/>
      <rect x='6.5' y='6.5' width='147' height='147' rx='17.5' fill='none' stroke='rgba(255,255,255,.10)'/>
      <g transform='translate(0,4)' stroke-linecap='round'>
        <!-- liquid -->
        <path d='M56 52H104L80 74Z' fill='#7A48D3' fill-opacity='.45'/>
        <!-- ice (clipped) -->
        <clipPath id='c'><path d='M58 54H102L80 73Z'/></clipPath>
        <g clip-path='url(#c)' stroke='rgba(255,255,255,.55)' fill='none' stroke-width='1.5'>
          <rect x='70' y='58' width='10' height='10' rx='1.6' transform='rotate(12 70 58)'/>
          <rect x='88' y='59' width='9.5' height='9.5' rx='1.5' transform='rotate(-14 88 59)'/>
        </g>
        <!-- stirrer (under rim) -->
        <path d='M96 36L112 20' stroke='rgba(255,255,255,.8)' stroke-width='2'/>
        <!-- bowl rim -->
        <path d='M50 46H110L80 80Z' fill='none' stroke='rgba(255,255,255,.85)' stroke-width='2'/>
        <!-- stem + base -->
        <path d='M80 80V112' stroke='rgba(255,255,255,.85)' stroke-width='2'/>
        <path d='M60 114H100' stroke='rgba(255,255,255,.65)' stroke-width='2'/>
      </g>
    </svg>`
  );

interface CartItemProps {
  item: CartItemType;
  onQuantityChange?: (itemId: string, quantity: number) => void;
  onRemove?: (itemId: string) => void;
  showActions?: boolean;
}

export default function CartItem({ 
  item, 
  onQuantityChange, 
  onRemove, 
  showActions = true
}: CartItemProps) {
  const { updateQuantity, removeItem, isLoading } = useCartStore();
  const [imageError, setImageError] = useState(false);

  const handleQuantityChange = async (newQuantity: number) => {
    if (newQuantity < 0) return;
    
    if (onQuantityChange) {
      onQuantityChange(item.id, newQuantity);
    } else {
      // Optimistic update - update UI immediately
      const { updateQuantityOptimistic } = useCartStore.getState();
      updateQuantityOptimistic(item.id, newQuantity);
      
      // Sync with server in background (don't await)
      updateQuantity(item.id, newQuantity).catch(error => {
        console.error('Failed to sync quantity with server:', error);
        // Optionally show a toast notification or revert the change
      });
    }
  };

  const handleRemove = async () => {
    if (onRemove) {
      onRemove(item.id);
    } else {
      // Optimistic update - update UI immediately
      const { removeItemOptimistic } = useCartStore.getState();
      removeItemOptimistic(item.id);
      
      // Sync with server in background (don't await)
      removeItem(item.id).catch(error => {
        console.error('Failed to sync removal with server:', error);
        // Optionally show a toast notification or revert the change
      });
    }
  };

  const getItemName = () => {
    if (item.itemType === 'ticket') {
      return item.ticket?.name || 'Ticket';
    } else {
      const baseName = item.menuItem?.name || 'Menu Item';
      const variantName = item.variant?.name;
      return variantName ? `${baseName} - ${variantName}` : baseName;
    }
  };

  const getItemImage = () => {
    if (item.itemType === 'menu' && item.menuItem?.imageUrl) {
      return item.menuItem.imageUrl;
    }
    return null;
  };

  const isValidImageUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      // Check if it's a valid domain and not a placeholder
      const validDomains = [
        'nightlife-files.s3.amazonaws.com',
        's3.amazonaws.com',
        'localhost'
      ];
      
      return validDomains.some(domain => 
        urlObj.hostname === domain || 
        urlObj.hostname.endsWith(`.${domain}`)
      ) && !url.includes('placeholder') && !url.includes('cdn.mysite.com');
    } catch {
      return false;
    }
  };

  const getItemDescription = () => {
    if (item.itemType === 'ticket') {
      return item.ticket?.description;
    } else {
      return item.menuItem?.description;
    }
  };

  const formatPrice = (price: number | undefined) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(price || 0);
  };

  const getCategoryBadge = () => {
    if (item.itemType === 'ticket' && item.ticket?.category) {
      const categoryColors = {
        general: 'bg-blue-100 text-blue-800',
        event: 'bg-purple-100 text-purple-800',
        free: 'bg-green-100 text-green-800',
      };
      
      return (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${categoryColors[item.ticket.category]}`}>
          {item.ticket.category === 'general' ? 'General' : 
           item.ticket.category === 'event' ? 'Evento' : 'Gratis'}
        </span>
      );
    }
    return null;
  };

  const getMaxPerPerson = () => {
    if (item.itemType === 'ticket') {
      return item.ticket?.maxPerPerson;
    } else {
      // For menu items, check variant first, then menu item
      return item.variant?.maxPerPerson ?? item.menuItem?.maxPerPerson;
    }
  };

  const isAtMaxLimit = () => {
    const maxPerPerson = getMaxPerPerson();
    if (!maxPerPerson || maxPerPerson <= 0) return false;
    return item.quantity >= maxPerPerson;
  };


  return (
    <div className="p-3 sm:p-4 bg-slate-800/50 rounded-lg border border-slate-700/60 hover:border-slate-600/80 transition-colors">
      {/* Mobile Layout - Stacked */}
      <div className="block sm:hidden">
        {/* Header with image and basic info */}
        <div className="flex items-start space-x-3 mb-3">
          {/* Item Image - Only for menu items */}
          {item.itemType === 'menu' && (
            <div className="flex-shrink-0">
              <div className="relative w-12 h-12 rounded-lg overflow-hidden ring-1 ring-white/10">
                <img
                  src={
                    getItemImage() && isValidImageUrl(getItemImage()!) && !imageError
                      ? getItemImage()!
                      : PLACEHOLDER_DATA_URL
                  }
                  alt={getItemName()}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                  onLoad={() => setImageError(false)}
                />
              </div>
            </div>
          )}
          
          {/* Item name and price */}
          <div className="flex-1 min-w-0 max-w-full">
            <h3 className="text-sm font-medium text-slate-100 leading-tight break-words">
              {getItemName()}
            </h3>
            <div className="mt-1">
              {(() => {
                const hasDynamicPrice = item.dynamicPrice && item.dynamicPrice !== null && item.dynamicPrice !== undefined;
                const isDiscount = hasDynamicPrice && Number(item.dynamicPrice) < Number(item.unitPrice);
                
                return isDiscount ? (
                  <div>
                    <p className="text-sm font-medium text-slate-100">
                      {formatPrice(item.dynamicPrice || 0)}
                    </p>
                    <p className="text-xs text-slate-400 line-through">
                      {formatPrice(item.unitPrice)}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm font-medium text-slate-100">
                    {formatPrice(item.dynamicPrice || item.unitPrice)}
                  </p>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Description and badges */}
        {getItemDescription() && (
          <p className="text-xs text-slate-400 mb-2 line-clamp-2">
            {getItemDescription()}
          </p>
        )}
        
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {getCategoryBadge()}
          <span className="text-xs text-slate-400">
            {item.date}
          </span>
          {isAtMaxLimit() && (
            <span className="text-xs text-amber-400">
              Límite alcanzado
            </span>
          )}
        </div>

        {/* Quantity Controls - Mobile */}
        {showActions && (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => item.quantity === 1 ? handleRemove() : handleQuantityChange(item.quantity - 1)}
                  disabled={isLoading}
                  className={`p-2 rounded-full hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed ${
                    item.quantity === 1 ? 'text-red-400 hover:text-red-300 hover:bg-red-900/20' : ''
                  }`}
                >
                  {item.quantity === 1 ? (
                    <Trash2 className="h-4 w-4" />
                  ) : (
                    <Minus className="h-4 w-4 text-slate-300" />
                  )}
                </button>
              </div>
              
              <span className="text-sm font-medium text-slate-100 min-w-[2rem] text-center">
                {item.quantity}
              </span>
              
              <div className="w-8 h-8 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => handleQuantityChange(item.quantity + 1)}
                  disabled={isLoading || isAtMaxLimit()}
                  className="p-2 rounded-full hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="h-4 w-4 text-slate-300" />
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="text-right w-20">
                <div className="text-sm font-medium text-slate-100">
                  {formatPrice((item.dynamicPrice || item.unitPrice) * item.quantity)}
                </div>
                {item.quantity > 1 && (
                  <div className="text-xs text-slate-400">
                    {formatPrice(item.dynamicPrice || item.unitPrice)} c/u
                  </div>
                )}
              </div>
              
              {item.quantity > 1 && (
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={isLoading}
                  className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Desktop Layout - Horizontal */}
      <div className="hidden sm:flex items-start space-x-4">
        {/* Item Image - Only for menu items */}
        <div className="flex-shrink-0">
          {item.itemType === 'menu' && (
            <div className="relative w-16 h-16 rounded-lg overflow-hidden ring-1 ring-white/10">
              <img
                src={
                  getItemImage() && isValidImageUrl(getItemImage()!) && !imageError
                    ? getItemImage()!
                    : PLACEHOLDER_DATA_URL
                }
                alt={getItemName()}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
                onLoad={() => setImageError(false)}
              />
            </div>
          )}
        </div>

        {/* Item Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 max-w-full">
              <h3 className="text-sm font-medium text-slate-100 break-words">
                {getItemName()}
              </h3>
              {getItemDescription() && (
                <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                  {getItemDescription()}
                </p>
              )}
              <div className="flex items-center space-x-2 mt-2">
                {getCategoryBadge()}
                <span className="text-xs text-slate-400">
                  {item.date}
                </span>
                {isAtMaxLimit() && (
                  <span className="text-xs text-amber-400">
                    Límite alcanzado
                  </span>
                )}
              </div>
            </div>
            
            {/* Price */}
            <div className="text-right">
              {(() => {
                const hasDynamicPrice = item.dynamicPrice && item.dynamicPrice !== null && item.dynamicPrice !== undefined;
                const isDiscount = hasDynamicPrice && Number(item.dynamicPrice) < Number(item.unitPrice);
                
                return isDiscount ? (
                  <>
                    <p className="text-sm font-medium text-slate-100">
                      {formatPrice(item.dynamicPrice || 0)}
                    </p>
                    <p className="text-xs text-slate-400 line-through">
                      {formatPrice(item.unitPrice)}
                    </p>
                  </>
                ) : (
                  <p className="text-sm font-medium text-slate-100">
                    {formatPrice(item.dynamicPrice || item.unitPrice)}
                  </p>
                );
              })()}
            </div>
          </div>

          {/* Quantity Controls */}
          {showActions && (
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => item.quantity === 1 ? handleRemove() : handleQuantityChange(item.quantity - 1)}
                    disabled={isLoading}
                    className={`p-1 rounded-full hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed ${
                      item.quantity === 1 ? 'text-red-400 hover:text-red-300 hover:bg-red-900/20' : ''
                    }`}
                  >
                    {item.quantity === 1 ? (
                      <Trash2 className="h-4 w-4" />
                    ) : (
                      <Minus className="h-4 w-4 text-slate-300" />
                    )}
                  </button>
                </div>
                
                <span className="text-sm font-medium text-slate-100 min-w-[2rem] text-center">
                  {item.quantity}
                </span>
                
                <div className="w-6 h-6 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(item.quantity + 1)}
                    disabled={isLoading || isAtMaxLimit()}
                    className="p-1 rounded-full hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-4 w-4 text-slate-300" />
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <div className="text-right w-20">
                  <div className="text-sm font-medium text-slate-100">
                    {formatPrice((item.dynamicPrice || item.unitPrice) * item.quantity)}
                  </div>
                  {item.quantity > 1 && (
                    <div className="text-xs text-slate-400">
                      {formatPrice(item.dynamicPrice || item.unitPrice)} c/u
                    </div>
                  )}
                </div>
                
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={isLoading}
                  className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
