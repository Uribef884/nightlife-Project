'use client';

import React, { useState } from 'react';
import { TicketCartButton, MenuCartButton } from './UnifiedCartButton';
import CartQuantityControls from './CartQuantityControls';

export default function CartIntegrationExample() {
  const [selectedDate, setSelectedDate] = useState<string>('2025-09-14');

  return (
    <div className="p-6 space-y-8 bg-slate-900 text-white">
      <h1 className="text-2xl font-bold">Cart Integration Examples</h1>
      
      {/* Date Selector */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Select Date:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white"
        />
      </div>

      {/* Ticket Examples */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Ticket Examples</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* General Ticket */}
          <div className="p-4 bg-slate-800 rounded-lg">
            <h3 className="font-medium mb-2">General Admission</h3>
            <p className="text-sm text-slate-300 mb-3">$50,000 COP</p>
            <TicketCartButton
              ticketId="6ae97c76-82ed-43cd-aa91-7ffafd32eb4d"
              date={selectedDate}
              maxPerPerson={5}
              addButtonText="Agregar entrada"
            />
          </div>

          {/* Event Ticket */}
          <div className="p-4 bg-slate-800 rounded-lg">
            <h3 className="font-medium mb-2">VIP Event Ticket</h3>
            <p className="text-sm text-slate-300 mb-3">$150,000 COP</p>
            <TicketCartButton
              ticketId="event-ticket-id"
              date={selectedDate}
              maxPerPerson={2}
              addButtonText="Agregar VIP"
              size="lg"
            />
          </div>

          {/* Free Ticket */}
          <div className="p-4 bg-slate-800 rounded-lg">
            <h3 className="font-medium mb-2">Free Entry</h3>
            <p className="text-sm text-slate-300 mb-3">Gratis</p>
            <TicketCartButton
              ticketId="free-ticket-id"
              date={selectedDate}
              maxPerPerson={1}
              addButtonText="Reservar gratis"
              variant="compact"
            />
          </div>
        </div>
      </div>

      {/* Menu Examples */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Menu Examples</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Simple Menu Item */}
          <div className="p-4 bg-slate-800 rounded-lg">
            <h3 className="font-medium mb-2">Cocktail Clásico</h3>
            <p className="text-sm text-slate-300 mb-3">$25,000 COP</p>
            <MenuCartButton
              menuItemId="7f954987-5627-47ff-b6f1-7e0b262775fd"
              date={selectedDate}
              maxPerPerson={3}
              addButtonText="Agregar bebida"
            />
          </div>

          {/* Menu Item with Variants */}
          <div className="p-4 bg-slate-800 rounded-lg">
            <h3 className="font-medium mb-2">Pizza (con variantes)</h3>
            <p className="text-sm text-slate-300 mb-3">Desde $35,000 COP</p>
            <MenuCartButton
              menuItemId="pizza-item-id"
              variantId="pizza-margherita-variant-id"
              date={selectedDate}
              maxPerPerson={2}
              addButtonText="Agregar pizza"
            />
          </div>

          {/* Premium Menu Item */}
          <div className="p-4 bg-slate-800 rounded-lg">
            <h3 className="font-medium mb-2">Premium Cocktail</h3>
            <p className="text-sm text-slate-300 mb-3">$45,000 COP</p>
            <MenuCartButton
              menuItemId="premium-cocktail-id"
              date={selectedDate}
              maxPerPerson={1}
              addButtonText="Agregar premium"
              size="lg"
              variant="minimal"
            />
          </div>
        </div>
      </div>

      {/* Standalone Quantity Controls Example */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Standalone Quantity Controls</h2>
        
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-slate-800 rounded-lg">
            <h3 className="font-medium mb-2">Default Style</h3>
            <CartQuantityControls
              quantity={2}
              onDecrease={() => console.log('Decrease')}
              onIncrease={() => console.log('Increase')}
              maxQuantity={5}
            />
          </div>

          <div className="p-4 bg-slate-800 rounded-lg">
            <h3 className="font-medium mb-2">Compact Style</h3>
            <CartQuantityControls
              quantity={1}
              onDecrease={() => console.log('Decrease')}
              onIncrease={() => console.log('Increase')}
              maxQuantity={3}
              variant="compact"
              size="sm"
            />
          </div>

          <div className="p-4 bg-slate-800 rounded-lg">
            <h3 className="font-medium mb-2">Minimal Style</h3>
            <CartQuantityControls
              quantity={3}
              onDecrease={() => console.log('Decrease')}
              onIncrease={() => console.log('Increase')}
              maxQuantity={10}
              variant="minimal"
              size="lg"
            />
          </div>
        </div>
      </div>

      {/* Usage Instructions */}
      <div className="p-4 bg-slate-800 rounded-lg">
        <h2 className="text-xl font-semibold mb-3">Usage Instructions</h2>
        <div className="space-y-2 text-sm text-slate-300">
          <p>• <strong>TicketCartButton:</strong> Use for tickets, automatically handles ticket-specific logic</p>
          <p>• <strong>MenuCartButton:</strong> Use for menu items, supports variants with variantId prop</p>
          <p>• <strong>UnifiedCartButton:</strong> Generic button for any item type</p>
          <p>• <strong>CartQuantityControls:</strong> Standalone quantity controls for custom implementations</p>
          <p>• <strong>useCartItem:</strong> Hook for custom cart integration logic</p>
        </div>
      </div>
    </div>
  );
}