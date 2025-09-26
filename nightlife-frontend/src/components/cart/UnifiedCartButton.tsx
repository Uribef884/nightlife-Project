'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import { useCartItem } from '@/hooks/useCartItem';
import CartQuantityControls from './CartQuantityControls';
import { CartClubChangeModal } from './CartClubChangeModal';

interface UnifiedCartButtonProps {
  itemType: 'ticket' | 'menu';
  itemId: string;
  variantId?: string;
  date?: string;
  maxPerPerson?: number;
  disabled?: boolean;
  className?: string;
  addButtonText?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'compact' | 'minimal';
  showIcon?: boolean;
  onAdd?: () => void;
  onQuantityChange?: (quantity: number) => void;
  clubId?: string;
  clubName?: string;
}

export default function UnifiedCartButton({
  itemType,
  itemId,
  variantId,
  date,
  maxPerPerson = Infinity,
  disabled = false,
  className = '',
  addButtonText = 'Agregar al carrito',
  size = 'md',
  variant = 'default',
  showIcon = true,
  onAdd,
  onQuantityChange,
  clubId,
  clubName,
}: UnifiedCartButtonProps) {
  const {
    quantity,
    isInCart,
    increaseQuantity,
    decreaseQuantity,
    showClubModal,
    currentClubName,
    handleClearCartAndClose,
    handleCancelClubChange,
  } = useCartItem({
    itemType,
    itemId,
    variantId,
    date,
    maxPerPerson,
    clubId,
    clubName,
  });

  const handleAdd = async () => {
    try {
      await increaseQuantity();
      onAdd?.();
      onQuantityChange?.(quantity + 1);
    } catch (error) {
      console.error('Error adding to cart:', error);
    }
  };

  const handleIncrease = async () => {
    try {
      await increaseQuantity();
      onQuantityChange?.(quantity + 1);
    } catch (error) {
      console.error('Error increasing quantity:', error);
    }
  };

  const handleDecrease = async () => {
    try {
      await decreaseQuantity();
      onQuantityChange?.(quantity - 1);
    } catch (error) {
      console.error('Error decreasing quantity:', error);
    }
  };

  const sizeClasses = {
    sm: 'py-1.5 px-3 text-sm',
    md: 'py-2 px-4 text-sm',
    lg: 'py-3 px-6 text-base',
  };

  const buttonClasses = `
    w-full rounded-full font-semibold transition-colors duration-200
    ${sizeClasses[size]}
    ${disabled 
      ? 'bg-white/10 text-white/60 cursor-not-allowed' 
      : 'bg-green-600 hover:bg-green-500 text-white'
    }
    ${className}
  `;

  // Show quantity controls if item is in cart
  if (isInCart) {
    return (
      <>
        <CartQuantityControls
          quantity={quantity}
          onDecrease={handleDecrease}
          onIncrease={handleIncrease}
          maxQuantity={maxPerPerson}
          minQuantity={0}
          disabled={disabled}
          size={size}
          variant={variant}
          className="justify-center"
        />
        
        {/* Club Change Modal */}
        {showClubModal && (
          <CartClubChangeModal
            isOpen={showClubModal}
            onClose={handleCancelClubChange!}
            onClearCart={handleClearCartAndClose!}
            currentClubName={currentClubName}
            newClubName={clubName}
          />
        )}
      </>
    );
  }

  // Show add to cart button
  return (
    <>
      <button
        type="button"
        onClick={handleAdd}
        disabled={disabled || !date}
        className={buttonClasses}
      >
        <div className="flex items-center justify-center space-x-2">
          {showIcon && <Plus className="h-4 w-4" />}
          <span>
            {!date ? 'Selecciona fecha' : addButtonText}
          </span>
        </div>
      </button>
      
      {/* Club Change Modal */}
      {showClubModal && (
        <CartClubChangeModal
          isOpen={showClubModal}
          onClose={handleCancelClubChange!}
          onClearCart={handleClearCartAndClose!}
          currentClubName={currentClubName}
          newClubName={clubName}
        />
      )}
    </>
  );
}

// Specialized cart button for tickets
export function TicketCartButton({
  ticketId,
  date,
  maxPerPerson,
  disabled,
  className,
  addButtonText = 'Agregar entrada',
  size = 'md',
  variant = 'default',
  showIcon = true,
  onAdd,
  onQuantityChange,
  clubId,
  clubName,
}: Omit<UnifiedCartButtonProps, 'itemType' | 'itemId'> & {
  ticketId: string;
}) {
  return (
    <UnifiedCartButton
      itemType="ticket"
      itemId={ticketId}
      date={date}
      maxPerPerson={maxPerPerson}
      disabled={disabled}
      className={className}
      addButtonText={addButtonText}
      size={size}
      variant={variant}
      showIcon={showIcon}
      onAdd={onAdd}
      onQuantityChange={onQuantityChange}
      clubId={clubId}
      clubName={clubName}
    />
  );
}

// Specialized cart button for menu items
export function MenuCartButton({
  menuItemId,
  variantId,
  date,
  maxPerPerson,
  disabled,
  className,
  addButtonText = 'Agregar al carrito',
  size = 'md',
  variant = 'default',
  showIcon = true,
  onAdd,
  onQuantityChange,
  clubId,
  clubName,
}: Omit<UnifiedCartButtonProps, 'itemType' | 'itemId'> & {
  menuItemId: string;
  variantId?: string;
}) {
  return (
    <UnifiedCartButton
      itemType="menu"
      itemId={menuItemId}
      variantId={variantId}
      date={date}
      maxPerPerson={maxPerPerson}
      disabled={disabled}
      className={className}
      addButtonText={addButtonText}
      size={size}
      variant={variant}
      showIcon={showIcon}
      onAdd={onAdd}
      onQuantityChange={onQuantityChange}
      clubId={clubId}
      clubName={clubName}
    />
  );
}