'use client';

import { useState, useEffect } from 'react';
import { Plus, Menu as MenuIcon, FileText, Settings, Package, Loader2, Upload, X } from 'lucide-react';
import { getMenuConfig, updateMenuType, type MenuConfigResponse } from '@/services/menu.service';

interface MenuManagementProps {
  clubId: string;
}

type MenuType = 'structured' | 'pdf' | 'none';

export function MenuManagement({ clubId: _clubId }: MenuManagementProps) {
  const [menuType, setMenuType] = useState<MenuType>('structured');
  const [activeTab, setActiveTab] = useState<'categories' | 'items' | 'config'>('categories');
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPdfUpload, setHasPdfUpload] = useState(false);
  const [hasStructuredItems, setHasStructuredItems] = useState(false);
  const [showPdfUploadModal, setShowPdfUploadModal] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  // Load menu configuration on component mount
  useEffect(() => {
    const loadMenuConfig = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const config = await getMenuConfig();
        console.log('Menu config loaded:', config);
        setMenuType(config.menuType);
        
        // Check if PDF is already uploaded
        const hasPdf = !!(config.pdfMenuUrl || config.pdfMenuId);
        console.log('PDF check - pdfMenuUrl:', config.pdfMenuUrl, 'pdfMenuId:', config.pdfMenuId, 'hasPdf:', hasPdf);
        setHasPdfUpload(hasPdf);
        
        // TODO: Replace with actual API calls to check prerequisites
        // For now, using mock data to demonstrate validation
        setHasStructuredItems(mockCategories.length > 0 && mockItems.length > 0);
      } catch (err) {
        console.error('Failed to load menu config:', err);
        setError(err instanceof Error ? err.message : 'Failed to load menu configuration');
      } finally {
        setIsLoading(false);
      }
    };

    loadMenuConfig();
  }, []);

  // Handle menu type change with validation rules
  const handleMenuTypeChange = async (newMenuType: MenuType) => {
    if (newMenuType === menuType || isUpdating) return;

    // Show PDF upload modal if trying to switch to PDF without upload
    if (newMenuType === 'pdf' && !hasPdfUpload) {
      setShowPdfUploadModal(true);
      return;
    }

    // Allow switching to structured and none without prerequisites
    // Users can add items after switching to structured

    try {
      setIsUpdating(true);
      setError(null);
      await updateMenuType(newMenuType);
      setMenuType(newMenuType);
    } catch (err) {
      console.error('Failed to update menu type:', err);
      setError(err instanceof Error ? err.message : 'Failed to update menu type');
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle PDF upload
  const handlePdfUpload = async (file: File) => {
    try {
      setIsUploadingPdf(true);
      setError(null);
      
      // TODO: Replace with actual PDF upload API call
      // For now, simulate upload
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setHasPdfUpload(true);
      setShowPdfUploadModal(false);
      
      // Automatically switch to PDF menu type after successful upload
      await updateMenuType('pdf');
      setMenuType('pdf');
      
    } catch (err) {
      console.error('Failed to upload PDF:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload PDF');
    } finally {
      setIsUploadingPdf(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setError('Please select a PDF file.');
        return;
      }
      handlePdfUpload(file);
    }
  };

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          <span className="text-gray-600 dark:text-gray-400">Loading menu configuration...</span>
        </div>
      </div>
    );
  }

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
        {menuType === 'structured' && (
          <button className="flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors w-full sm:w-auto">
            <Plus className="w-4 h-4" />
            <span>Add Item</span>
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Settings className="w-5 h-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Error
              </h3>
              <div className="mt-1 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {!error && hasPdfUpload && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Settings className="w-5 h-5 text-green-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                PDF Ready
              </h3>
              <div className="mt-1 text-sm text-green-700 dark:text-green-300">
                PDF menu is uploaded. You can now switch to PDF menu type.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Menu Type Selection */}
      <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Menu Configuration
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={() => handleMenuTypeChange('structured')}
            disabled={isUpdating}
            className={`
              p-4 border-2 rounded-lg text-left transition-colors relative
              ${menuType === 'structured'
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }
              ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {isUpdating && menuType === 'structured' && (
              <div className="absolute top-2 right-2">
                <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
              </div>
            )}
            <MenuIcon className="w-8 h-8 mb-2 text-purple-600 dark:text-purple-400" />
            <h4 className="font-semibold text-gray-900 dark:text-white">Structured Menu</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Organize items by categories with variants
            </p>
          </button>
          
          <button
            onClick={() => handleMenuTypeChange('pdf')}
            disabled={isUpdating}
            className={`
              p-4 border-2 rounded-lg text-left transition-colors relative
              ${menuType === 'pdf'
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }
              ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {isUpdating && menuType === 'pdf' && (
              <div className="absolute top-2 right-2">
                <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
              </div>
            )}
            <FileText className="w-8 h-8 mb-2 text-purple-600 dark:text-purple-400" />
            <h4 className="font-semibold text-gray-900 dark:text-white">PDF Menu</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {hasPdfUpload ? 'PDF menu is uploaded and ready' : 'Upload a PDF menu for display'}
            </p>
            {hasPdfUpload && (
              <div className="mt-2 flex items-center text-xs text-green-600 dark:text-green-400">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                PDF Available
              </div>
            )}
          </button>
          
          <button
            onClick={() => handleMenuTypeChange('none')}
            disabled={isUpdating}
            className={`
              p-4 border-2 rounded-lg text-left transition-colors relative
              ${menuType === 'none'
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }
              ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {isUpdating && menuType === 'none' && (
              <div className="absolute top-2 right-2">
                <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
              </div>
            )}
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

      {/* PDF Upload Modal */}
      {showPdfUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Upload PDF Menu
                </h3>
                <button
                  onClick={() => setShowPdfUploadModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                To use PDF menu, please upload a PDF file of your menu.
              </p>
              
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Choose a PDF file to upload
                  </p>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    disabled={isUploadingPdf}
                    className="hidden"
                    id="pdf-upload"
                  />
                  <label
                    htmlFor="pdf-upload"
                    className={`
                      inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 cursor-pointer transition-colors
                      ${isUploadingPdf ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    {isUploadingPdf ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Choose PDF File
                      </>
                    )}
                  </label>
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowPdfUploadModal(false)}
                    disabled={isUploadingPdf}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
