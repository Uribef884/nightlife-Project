'use client';

import { useState } from 'react';
import { Plus, Ticket, Calendar, DollarSign } from 'lucide-react';

interface TicketsManagementProps {
  clubId: string;
}

type TicketType = 'general' | 'event' | 'free';

export function TicketsManagement({ clubId: _clubId }: TicketsManagementProps) {
  const [activeTab, setActiveTab] = useState<TicketType>('general');

  const mockTickets = {
    general: [
      {
        id: '1',
        name: 'VIP Entry',
        price: 50,
        maxPerPerson: 4,
        priority: 1,
        dynamicPricingEnabled: true
      },
      {
        id: '2',
        name: 'Regular Entry',
        price: 25,
        maxPerPerson: 6,
        priority: 2,
        dynamicPricingEnabled: false
      }
    ],
    event: [
      {
        id: '3',
        name: 'New Year Party',
        price: 75,
        maxPerPerson: 2,
        priority: 1,
        eventId: 'event-1',
        quantity: 100
      }
    ],
    free: [
      {
        id: '4',
        name: 'Ladies Night',
        price: 0,
        maxPerPerson: 1,
        priority: 1,
        quantity: 50,
        availableDate: '2024-01-15'
      }
    ]
  };

  const tabs = [
    { key: 'general', label: 'General Tickets', icon: Ticket },
    { key: 'event', label: 'Event Tickets', icon: Calendar },
    { key: 'free', label: 'Free Tickets', icon: DollarSign }
  ] as const;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Tickets Management
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Create and manage tickets for your club
          </p>
        </div>
        <button className="flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors w-full sm:w-auto">
          <Plus className="w-4 h-4" />
          <span>Create Ticket</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex flex-wrap gap-2 sm:gap-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                  ${isActive
                    ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Ticket List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6">
          <div className="space-y-4">
            {mockTickets[activeTab].map((ticket) => (
              <div
                key={ticket.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-gray-200 dark:border-gray-600 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate">
                      {ticket.name}
                    </h3>
                    <span className={`
                      px-2 py-1 text-xs font-medium rounded-full w-fit
                      ${ticket.price === 0 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                      }
                    `}>
                      {ticket.price === 0 ? 'FREE' : `$${ticket.price}`}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    <span>Max: {ticket.maxPerPerson}</span>
                    <span>Priority: {ticket.priority}</span>
                    {'dynamicPricingEnabled' in ticket && ticket.dynamicPricingEnabled && (
                      <span className="text-purple-600 dark:text-purple-400">
                        Dynamic
                      </span>
                    )}
                    {'quantity' in ticket && ticket.quantity && (
                      <span>Qty: {ticket.quantity}</span>
                    )}
                    {'availableDate' in ticket && ticket.availableDate && (
                      <span>Date: {ticket.availableDate}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-end sm:justify-start space-x-2">
                  <button className="px-3 py-1 text-xs sm:text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    Edit
                  </button>
                  <button className="px-3 py-1 text-xs sm:text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            ))}
            
            {mockTickets[activeTab].length === 0 && (
              <div className="text-center py-12">
                <Ticket className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No {activeTab} tickets found
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Create your first {activeTab} ticket to get started.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
