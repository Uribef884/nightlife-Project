'use client';

import { useState } from 'react';
import { Plus, Megaphone, Image, Target, Eye, EyeOff } from 'lucide-react';

interface AdsManagerProps {
  clubId: string;
}

type AdType = 'club' | 'global';

export function AdsManager({ clubId: _clubId }: AdsManagerProps) {
  const [activeTab, setActiveTab] = useState<AdType>('club');

  const mockClubAds = [
    {
      id: '1',
      imageUrl: '/api/placeholder/400/300',
      priority: 1,
      isVisible: true,
      targetType: 'event',
      targetId: 'event-1',
      createdAt: '2024-01-15T10:00:00Z'
    },
    {
      id: '2',
      imageUrl: '/api/placeholder/400/300',
      priority: 2,
      isVisible: false,
      targetType: 'ticket',
      targetId: 'ticket-1',
      createdAt: '2024-01-14T15:30:00Z'
    }
  ];

  const mockGlobalAds = [
    {
      id: '3',
      imageUrl: '/api/placeholder/400/300',
      priority: 1,
      isVisible: true,
      targetType: null,
      targetId: null,
      createdAt: '2024-01-13T09:00:00Z'
    }
  ];

  const tabs = [
    { key: 'club', label: 'Club Ads', icon: Megaphone },
    { key: 'global', label: 'Global Ads', icon: Target }
  ] as const;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const currentAds = activeTab === 'club' ? mockClubAds : mockGlobalAds;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Ads Manager
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Create and manage promotional ads for your club
          </p>
        </div>
        <button className="flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors w-full sm:w-auto">
          <Plus className="w-4 h-4" />
          <span>Create Ad</span>
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

      {/* Ads Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {currentAds.map((ad) => (
          <div
            key={ad.id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden"
          >
            {/* Ad Image */}
            <div className="relative h-48 bg-gradient-to-r from-purple-500 to-pink-500">
              <div className="absolute inset-0 flex items-center justify-center">
                <Image className="w-12 h-12 text-white opacity-50" />
              </div>
              <div className="absolute top-2 right-2">
                <span className={`
                  px-2 py-1 text-xs font-medium rounded-full
                  ${ad.isVisible 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                  }
                `}>
                  {ad.isVisible ? 'VISIBLE' : 'HIDDEN'}
                </span>
              </div>
              <div className="absolute top-2 left-2">
                <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 rounded-full">
                  Priority {ad.priority}
                </span>
              </div>
            </div>

            {/* Ad Details */}
            <div className="p-4">
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Target:</span>
                  <span className="text-gray-900 dark:text-white">
                    {ad.targetType ? `${ad.targetType} - ${ad.targetId}` : 'Global'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Created:</span>
                  <span className="text-gray-900 dark:text-white">
                    {formatDate(ad.createdAt)}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button className="flex-1 px-3 py-2 text-sm bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-md hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors">
                  Edit
                </button>
                <button className={`
                  px-3 py-2 text-sm rounded-md transition-colors
                  ${ad.isVisible
                    ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-800'
                    : 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800'
                  }
                `}>
                  {ad.isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button className="px-3 py-2 text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800 transition-colors">
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {currentAds.length === 0 && (
        <div className="text-center py-12">
          <Megaphone className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No {activeTab} ads found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Create your first {activeTab} ad to promote your club.
          </p>
        </div>
      )}

      {/* Ad Creation Form */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Create New Ad
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Ad Image
            </label>
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
              <Image className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Upload your ad image (JPEG, PNG, WebP - Max 5MB)
              </p>
              <button className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors">
                Choose File
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Priority
              </label>
              <input
                type="number"
                min="1"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Target Type
              </label>
              <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option value="">None (Global)</option>
                <option value="event">Event</option>
                <option value="ticket">Ticket</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <input type="checkbox" id="isVisible" defaultChecked />
            <label htmlFor="isVisible" className="text-sm text-gray-700 dark:text-gray-300">
              Make ad visible immediately
            </label>
          </div>
          
          <button className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors">
            Create Ad
          </button>
        </div>
      </div>
    </div>
  );
}
