'use client';

import { useState } from 'react';
import { ShoppingCart, Ticket, User, QrCode } from 'lucide-react';

interface PurchasesHistoryProps {
  clubId: string;
}

type PurchaseType = 'tickets' | 'menu';

export function PurchasesHistory({ clubId: _clubId }: PurchasesHistoryProps) {
  const [activeTab, setActiveTab] = useState<PurchaseType>('tickets');
  const [dateRange, setDateRange] = useState('7d');

  const mockTicketPurchases = [
    {
      id: '1',
      buyerName: 'John Doe',
      buyerEmail: 'john@example.com',
      items: [
        { name: 'VIP Entry', quantity: 2, price: 50 }
      ],
      total: 100,
      purchaseDate: '2024-01-15T20:30:00Z',
      qrStatus: 'used',
      qrUsedAt: '2024-01-15T22:15:00Z'
    },
    {
      id: '2',
      buyerName: 'Jane Smith',
      buyerEmail: 'jane@example.com',
      items: [
        { name: 'Regular Entry', quantity: 1, price: 25 }
      ],
      total: 25,
      purchaseDate: '2024-01-14T19:45:00Z',
      qrStatus: 'pending',
      qrUsedAt: null
    }
  ];

  const mockMenuPurchases = [
    {
      id: '3',
      buyerName: 'Mike Johnson',
      buyerEmail: 'mike@example.com',
      items: [
        { name: 'Mojito', quantity: 2, price: 12 },
        { name: 'Pizza Margherita', quantity: 1, price: 18 }
      ],
      total: 42,
      purchaseDate: '2024-01-15T21:00:00Z',
      qrStatus: 'used',
      qrUsedAt: '2024-01-15T21:30:00Z'
    }
  ];

  const tabs = [
    { key: 'tickets', label: 'Ticket Purchases', icon: Ticket },
    { key: 'menu', label: 'Menu Purchases', icon: ShoppingCart }
  ] as const;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getQrStatusBadge = (status: string) => {
    switch (status) {
      case 'used':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'expired':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Purchases History
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            View all ticket and menu purchases for your club
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm sm:text-base"
          >
            <option value="1d">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 3 months</option>
          </select>
        </div>
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

      {/* Purchases List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6">
          <div className="space-y-6">
            {(activeTab === 'tickets' ? mockTicketPurchases : mockMenuPurchases).map((purchase) => (
              <div
                key={purchase.id}
                className="border border-gray-200 dark:border-gray-600 rounded-lg p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {purchase.buyerName}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {purchase.buyerEmail}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      ${purchase.total}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(purchase.purchaseDate)}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {purchase.items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                      <span className="text-gray-900 dark:text-white">
                        {item.name} x{item.quantity}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        ${item.price * item.quantity}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <QrCode className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">QR Status:</span>
                    <span className={`
                      px-2 py-1 text-xs font-medium rounded-full
                      ${getQrStatusBadge(purchase.qrStatus)}
                    `}>
                      {purchase.qrStatus.toUpperCase()}
                    </span>
                  </div>
                  {purchase.qrUsedAt && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Used at: {formatDate(purchase.qrUsedAt)}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {(activeTab === 'tickets' ? mockTicketPurchases : mockMenuPurchases).length === 0 && (
              <div className="text-center py-12">
                <ShoppingCart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No {activeTab} purchases found
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {activeTab === 'tickets' 
                    ? 'No ticket purchases have been made yet.'
                    : 'No menu purchases have been made yet.'
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
