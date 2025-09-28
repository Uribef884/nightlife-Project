'use client';

import { useState } from 'react';
import { Plus, Menu as MenuIcon, FileText, Settings, Package } from 'lucide-react';

interface MenuManagementProps {
  clubId: string;
}

type MenuType = 'structured' | 'pdf' | 'none';

export function MenuManagement({ clubId: _clubId }: MenuManagementProps) {
  const [menuType, setMenuType] = useState<MenuType>('structured');
  const [activeTab, setActiveTab] = useState<'categories' | 'items' | 'config'>('categories');

  const mockCategories = [
    { id: '1', name: 'Cocktails', isActive: true },
    { id: '2', name: 'Beers', isActive: true },
    { id: '3', name: 'Food', isActive: false }
  ];

  const mockItems = [
    {
      id: '1',
      name: 'Mojito',
      description: 'Classic mint and lime cocktail',
      price: 12,
      maxPerPerson: 3,
      hasVariants: false,
      categoryId: '1'
    },
    {
      id: '2',
      name: 'Pizza',
      description: 'Various pizza options',
      price: null,
      maxPerPerson: null,
      hasVariants: true,
      categoryId: '3'
    }
  ];

  const tabs = [
    { key: 'categories', label: 'Categories', icon: Package },
    { key: 'items', label: 'Menu Items', icon: MenuIcon },
    { key: 'config', label: 'Configuration', icon: Settings }
  ] as const;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Menu Management
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Manage your club&apos;s menu items and categories
          </p>
        </div>
        <button className="flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors w-full sm:w-auto">
          <Plus className="w-4 h-4" />
          <span>Add Item</span>
        </button>
      </div>

      {/* Menu Type Selection */}
      <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Menu Configuration
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={() => setMenuType('structured')}
            className={`
              p-4 border-2 rounded-lg text-left transition-colors
              ${menuType === 'structured'
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }
            `}
          >
            <MenuIcon className="w-8 h-8 mb-2 text-purple-600 dark:text-purple-400" />
            <h4 className="font-semibold text-gray-900 dark:text-white">Structured Menu</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Organize items by categories with variants
            </p>
          </button>
          
          <button
            onClick={() => setMenuType('pdf')}
            className={`
              p-4 border-2 rounded-lg text-left transition-colors
              ${menuType === 'pdf'
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }
            `}
          >
            <FileText className="w-8 h-8 mb-2 text-purple-600 dark:text-purple-400" />
            <h4 className="font-semibold text-gray-900 dark:text-white">PDF Menu</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Upload a PDF menu for display
            </p>
          </button>
          
          <button
            onClick={() => setMenuType('none')}
            className={`
              p-4 border-2 rounded-lg text-left transition-colors
              ${menuType === 'none'
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }
            `}
          >
            <Settings className="w-8 h-8 mb-2 text-purple-600 dark:text-purple-400" />
            <h4 className="font-semibold text-gray-900 dark:text-white">No Menu</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Disable menu functionality
            </p>
          </button>
        </div>
      </div>

      {menuType === 'structured' && (
        <>
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

          {/* Content */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 sm:p-6">
              {activeTab === 'categories' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Categories
                    </h3>
                    <button className="px-3 py-1 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors">
                      Add Category
                    </button>
                  </div>
                  
                  {mockCategories.map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <span className={`
                          w-3 h-3 rounded-full
                          ${category.isActive ? 'bg-green-500' : 'bg-gray-400'}
                        `} />
                        <span className="font-medium text-gray-900 dark:text-white">
                          {category.name}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                          Edit
                        </button>
                        <button className="px-2 py-1 text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800 transition-colors">
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'items' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Menu Items
                    </h3>
                    <button className="px-3 py-1 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors">
                      Add Item
                    </button>
                  </div>
                  
                  {mockItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {item.name}
                          </h4>
                          {item.hasVariants && (
                            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
                              Has Variants
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {item.description}
                        </p>
                        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                          {item.price && <span>${item.price}</span>}
                          {item.maxPerPerson && <span>Max: {item.maxPerPerson}</span>}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                          Edit
                        </button>
                        <button className="px-2 py-1 text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800 transition-colors">
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'config' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Menu Configuration
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          Dynamic Pricing
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Enable dynamic pricing for menu items
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {menuType === 'pdf' && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            PDF Menu Upload
          </h3>
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Upload your PDF menu file
            </p>
            <button className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors">
              Choose File
            </button>
          </div>
        </div>
      )}

      {menuType === 'none' && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="text-center py-8">
            <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Menu Disabled
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Menu functionality is currently disabled for this club.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
