'use client';

import { useState } from 'react';
import { Plus, Users, Shield, Coffee, Mail } from 'lucide-react';

interface StaffManagementProps {
  clubId: string;
}

type StaffType = 'bouncers' | 'waiters';

export function StaffManagement({ clubId }: StaffManagementProps) {
  const [activeTab, setActiveTab] = useState<StaffType>('bouncers');

  const mockBouncers = [
    {
      id: '1',
      email: 'bouncer1@example.com',
      clubId: clubId,
      role: 'bouncer',
      isActive: true,
      createdAt: '2024-01-10T10:00:00Z',
      lastLogin: '2024-01-15T20:30:00Z'
    },
    {
      id: '2',
      email: 'bouncer2@example.com',
      clubId: clubId,
      role: 'bouncer',
      isActive: false,
      createdAt: '2024-01-12T14:30:00Z',
      lastLogin: null
    }
  ];

  const mockWaiters = [
    {
      id: '3',
      email: 'waiter1@example.com',
      clubId: clubId,
      role: 'waiter',
      isActive: true,
      createdAt: '2024-01-08T09:00:00Z',
      lastLogin: '2024-01-15T19:45:00Z'
    },
    {
      id: '4',
      email: 'waiter2@example.com',
      clubId: clubId,
      role: 'waiter',
      isActive: true,
      createdAt: '2024-01-14T16:00:00Z',
      lastLogin: '2024-01-15T21:15:00Z'
    }
  ];

  const tabs = [
    { key: 'bouncers', label: 'Bouncers', icon: Shield },
    { key: 'waiters', label: 'Waiters', icon: Coffee }
  ] as const;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const currentStaff = activeTab === 'bouncers' ? mockBouncers : mockWaiters;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Staff Management
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Manage bouncers and waiters for your club
          </p>
        </div>
        <button className="flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors w-full sm:w-auto">
          <Plus className="w-4 h-4" />
          <span>Add Staff</span>
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

      {/* Staff List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6">
          <div className="space-y-4">
            {currentStaff.map((staff) => (
              <div
                key={staff.id}
                className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg"
              >
                <div className="flex items-center space-x-4">
                  <div className={`
                    w-12 h-12 rounded-full flex items-center justify-center
                    ${staff.role === 'bouncer' 
                      ? 'bg-blue-100 dark:bg-blue-900' 
                      : 'bg-green-100 dark:bg-green-900'
                    }
                  `}>
                    {staff.role === 'bouncer' ? (
                      <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Coffee className="w-6 h-6 text-green-600 dark:text-green-400" />
                    )}
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {staff.email}
                    </h3>
                    <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center space-x-1">
                        <Mail className="w-3 h-3" />
                        <span>{staff.email}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className={`
                          w-2 h-2 rounded-full
                          ${staff.isActive ? 'bg-green-500' : 'bg-gray-400'}
                        `} />
                        <span>{staff.isActive ? 'Active' : 'Inactive'}</span>
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                      <span>Created: {formatDate(staff.createdAt)}</span>
                      <span className="mx-2">•</span>
                      <span>Last login: {formatDate(staff.lastLogin)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    Reset Password
                  </button>
                  <button className={`
                    px-3 py-1 text-sm rounded-md transition-colors
                    ${staff.isActive
                      ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-800'
                      : 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800'
                    }
                  `}>
                    {staff.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {currentStaff.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No {activeTab} found
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Add your first {activeTab.slice(0, -1)} to get started.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Staff Form */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Add New {activeTab.slice(0, -1).charAt(0).toUpperCase() + activeTab.slice(0, -1).slice(1)}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email Address
            </label>
            <input
              type="email"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="staff@example.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Temporary Password
            </label>
            <input
              type="password"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter temporary password"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input type="checkbox" id="sendEmail" defaultChecked />
            <label htmlFor="sendEmail" className="text-sm text-gray-700 dark:text-gray-300">
              Send login credentials via email
            </label>
          </div>
          
          <button className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors">
            Add {activeTab.slice(0, -1).charAt(0).toUpperCase() + activeTab.slice(0, -1).slice(1)}
          </button>
        </div>
      </div>
    </div>
  );
}
