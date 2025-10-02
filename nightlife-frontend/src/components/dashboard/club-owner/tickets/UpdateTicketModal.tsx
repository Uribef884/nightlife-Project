'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Edit3, Calendar, DollarSign, Users, Star, Ticket, AlertCircle, Trash2 } from 'lucide-react';
import { formatBogotaDate, maxSelectableDateInBogota } from '@/utils/timezone';

// Utility function to format numbers with thousand separators
const formatNumber = (value: number | string): string => {
  if (value === '' || value === null || value === undefined) return '';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '';
  return num.toLocaleString('es-CO');
};

// Utility function to parse formatted number back to number
const parseFormattedNumber = (value: string): number => {
  if (!value) return 0;
  // Remove thousand separators and parse
  const cleanValue = value.replace(/\./g, '');
  return parseFloat(cleanValue) || 0;
};

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price?: number;
  dynamicPrice?: number;
  dynamicPricingEnabled: boolean;
  hasVariants: boolean;
  categoryId: string;
  variants?: Array<{
    id: string;
    name: string;
    price: number;
    dynamicPrice?: number;
    dynamicPricingEnabled: boolean;
  }>;
}

interface MenuCategory {
  id: string;
  name: string;
  clubId: string;
}

interface Ticket {
  id: string;
  name: string;
  description?: string;
  price: number;
  dynamicPrice?: number;
  maxPerPerson: number;
  priority: number;
  quantity?: number;
  category: 'general' | 'event' | 'free' | 'combo';
  isActive: boolean;
  dynamicPricingEnabled: boolean;
  includesMenuItem: boolean;
  includedMenuItems?: unknown[];
  eventId?: string;
  availableDate?: string;
}

interface UpdateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  ticket: Ticket | null;
  clubId: string;
  events?: Array<{
    id: string;
    name: string;
    availableDate: string;
  }>;
}

interface TicketFormData {
  name: string;
  description: string;
  price: number;
  maxPerPerson: number;
  priority: number;
  category: 'general' | 'event' | 'free';
  quantity: number | null;
  availableDate: string | null;
  eventId: string | null;
  dynamicPricingEnabled: boolean;
  includesMenuItem: boolean;
  menuItems: Array<{
    categoryId: string;
    menuItemId: string;
    variantId: string | null;
    quantity: number;
  }>;
}

export function UpdateTicketModal({ isOpen, onClose, onSuccess, ticket, clubId, events = [] }: UpdateTicketModalProps) {
  const [formData, setFormData] = useState<TicketFormData>({
    name: '',
    description: '',
    price: 0,
    maxPerPerson: 10,
    priority: 1,
    category: 'general',
    quantity: null,
    availableDate: null,
    eventId: null,
    dynamicPricingEnabled: true,
    includesMenuItem: false,
    menuItems: []
  });
  
  const [originalData, setOriginalData] = useState<TicketFormData>({
    name: '',
    description: '',
    price: 0,
    maxPerPerson: 10,
    priority: 1,
    category: 'general',
    quantity: null,
    availableDate: null,
    eventId: null,
    dynamicPricingEnabled: true,
    includesMenuItem: false,
    menuItems: []
  });
  
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMenuItems, setLoadingMenuItems] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadMenuItems = useCallback(async () => {
    setLoadingMenuItems(true);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
      
      // First load categories
      const categoriesResponse = await fetch(`${API_BASE}/menu/categories/my/categories`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!categoriesResponse.ok) {
        const errorText = await categoriesResponse.text();
        console.error('Categories API error:', categoriesResponse.status, errorText);
        throw new Error(`Failed to load categories: ${categoriesResponse.status} ${errorText}`);
      }

      const categories = await categoriesResponse.json();
      setMenuCategories(categories);

      // Then load menu items for each category
      const allMenuItems: MenuItem[] = [];
      
      for (const category of categories) {
        const itemsResponse = await fetch(`${API_BASE}/menu/items/category/${category.id}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        if (itemsResponse.ok) {
          const items = await itemsResponse.json();
          allMenuItems.push(...items);
        } else {
          console.error(`Failed to load items for category ${category.id}:`, itemsResponse.status);
        }
      }

       setMenuItems(allMenuItems);
     } catch (error) {
       console.error('Error loading menu items:', error);
     } finally {
       setLoadingMenuItems(false);
     }
  }, []);

  // Load ticket menu items
  const loadTicketMenuItems = useCallback(async (ticketId: string) => {
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
      const url = `${API_BASE}/ticket-menu/${ticketId}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (response.ok) {
        const ticketMenuItems = await response.json();
        
        // Convert ticket menu items to form format
        const formattedMenuItems = ticketMenuItems.map((item: unknown) => {
          const menuItem = item as Record<string, unknown>;
          
          const formatted = {
            categoryId: (menuItem.categoryId as string) || '',
            menuItemId: (menuItem.menuItemId as string) || (menuItem.id as string) || (menuItem.menuItem?.id as string) || '',
            variantId: (menuItem.variantId as string) || (menuItem.menuItemVariantId as string) || (menuItem.variant?.id as string) || null,
            quantity: (menuItem.quantity as number) || (menuItem.qty as number) || 1
          };
          return formatted;
        });
        
        setFormData(prev => ({
          ...prev,
          menuItems: formattedMenuItems,
          includesMenuItem: formattedMenuItems.length > 0
        }));
        
        // Also update originalData to match the loaded menu items
        setOriginalData(prev => ({
          ...prev,
          menuItems: formattedMenuItems,
          includesMenuItem: formattedMenuItems.length > 0
        }));
      } else {
        console.error('Failed to load ticket menu items:', response.status, response.statusText);
        
        // If ticket has includesMenuItem but we can't load the items, still set it to true
        if (ticket?.includesMenuItem) {
          setFormData(prev => ({
            ...prev,
            includesMenuItem: true,
            menuItems: []
          }));
        }
      }
    } catch (error) {
      console.error('Error loading ticket menu items:', error);
      // If ticket has includesMenuItem but we can't load the items, still set it to true
      if (ticket?.includesMenuItem) {
        setFormData(prev => ({
          ...prev,
          includesMenuItem: true,
          menuItems: []
        }));
      }
    }
  }, [ticket]);

  // Initialize form data when ticket changes
  useEffect(() => {
    if (ticket && isOpen) {
      const initialData = {
        name: ticket.name || '',
        description: ticket.description || '',
        price: ticket.price || 0,
        maxPerPerson: ticket.maxPerPerson || 10,
        priority: ticket.priority || 1,
        category: ticket.category === 'combo' ? 'general' : ticket.category,
        quantity: ticket.quantity || null,
        availableDate: ticket.availableDate || null,
        eventId: ticket.eventId || null,
        dynamicPricingEnabled: ticket.dynamicPricingEnabled || false,
        includesMenuItem: ticket.includesMenuItem || false,
        menuItems: []
      };
      
      setFormData(initialData);
      setOriginalData(initialData);
      setErrors({});
      
      // Load menu items first, then load ticket menu items
      const initializeData = async () => {
        await loadMenuItems();
        
        // Load ticket's existing menu items if it includes menu items
        if (ticket.includesMenuItem) {
          await loadTicketMenuItems(ticket.id);
        }
      };
      
      initializeData();
    }
  }, [ticket, isOpen, loadMenuItems]);

  // iOS scroll lock handling
  useEffect(() => {
    if (isOpen) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        const scrollY = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';
      } else {
        document.body.style.overflow = 'hidden';
      }
    } else {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        const scrollY = document.body.style.top;
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      } else {
        document.body.style.overflow = 'unset';
      }
    }

    return () => {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
      } else {
        document.body.style.overflow = 'unset';
      }
    };
  }, [isOpen]);

  // Check if form has changes
  const hasChanges = (): boolean => {
    return (
      formData.name !== originalData.name ||
      formData.description !== originalData.description ||
      formData.price !== originalData.price ||
      formData.maxPerPerson !== originalData.maxPerPerson ||
      formData.priority !== originalData.priority ||
      formData.category !== originalData.category ||
      formData.quantity !== originalData.quantity ||
      formData.availableDate !== originalData.availableDate ||
      formData.eventId !== originalData.eventId ||
      formData.dynamicPricingEnabled !== originalData.dynamicPricingEnabled ||
      formData.includesMenuItem !== originalData.includesMenuItem ||
      JSON.stringify(formData.menuItems) !== JSON.stringify(originalData.menuItems)
    );
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    } else if (formData.name.length > 500) {
      newErrors.name = 'El nombre no puede exceder 500 caracteres';
    }

    // Price validation
    if (formData.price < 0) {
      newErrors.price = 'El precio no puede ser negativo';
    }

    // Max per person validation
    if (formData.maxPerPerson <= 0) {
      newErrors.maxPerPerson = 'Debe ser mayor a 0';
    }

    // Priority validation
    if (formData.priority < 1) {
      newErrors.priority = 'Debe ser mayor o igual a 1';
    }

    // Update-specific validation rules
    if (ticket) {
      // Cannot switch between free and paid on update
      const originalIsFree = ticket.price === 0;
      const newIsFree = formData.price === 0;
      if (originalIsFree !== newIsFree) {
        newErrors.price = 'No se puede cambiar entre ticket gratuito y de pago';
      }

      // Cannot add availableDate if eventId is present (for event tickets)
      if (ticket.eventId && formData.availableDate) {
        newErrors.availableDate = 'No se puede agregar fecha cuando el ticket está vinculado a un evento';
      }

      // Cannot update eventId once set
      if (ticket.eventId && formData.eventId !== ticket.eventId) {
        newErrors.eventId = 'No se puede cambiar el evento una vez establecido';
      }

      // Free tickets cannot have dynamic pricing enabled
      if (formData.price === 0 && formData.dynamicPricingEnabled) {
        newErrors.dynamicPricingEnabled = 'Los tickets gratuitos no pueden tener precio dinámico';
      }

      // Tickets created with includesMenuItem = false cannot add menu items on update
      if (!ticket.includesMenuItem && formData.includesMenuItem) {
        newErrors.includesMenuItem = 'No se pueden agregar elementos del menú a tickets que no los incluyeron originalmente';
      }
    }

    // Menu items validation
    if (formData.includesMenuItem && formData.menuItems.length === 0) {
      newErrors.menuItems = 'Debe agregar al menos un elemento del menú';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!ticket) return;
    
    // Check if there are any changes
    if (!hasChanges()) {
      onClose();
      return;
    }
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
      
      // Build update payload with only changed fields
      const requestBody: Record<string, unknown> = {};
      
      if (formData.name !== originalData.name) {
        requestBody.name = formData.name.trim();
      }
      
      if (formData.description !== originalData.description) {
        requestBody.description = formData.description.trim();
      }
      
      if (formData.price !== originalData.price) {
        requestBody.price = formData.price;
      }
      
      if (formData.maxPerPerson !== originalData.maxPerPerson) {
        requestBody.maxPerPerson = formData.maxPerPerson;
      }
      
      if (formData.priority !== originalData.priority) {
        requestBody.priority = formData.priority;
      }
      
      if (formData.dynamicPricingEnabled !== originalData.dynamicPricingEnabled) {
        requestBody.dynamicPricingEnabled = formData.dynamicPricingEnabled;
      }
      
      if (formData.includesMenuItem !== originalData.includesMenuItem) {
        requestBody.includesMenuItem = formData.includesMenuItem;
      }
      
      if (formData.quantity !== originalData.quantity) {
        requestBody.quantity = formData.quantity;
      }
      
      if (formData.availableDate !== originalData.availableDate) {
        requestBody.availableDate = formData.availableDate;
      }
      
      if (formData.eventId !== originalData.eventId) {
        requestBody.eventId = formData.eventId;
      }
      
      if (formData.category !== originalData.category) {
        requestBody.category = formData.category;
      }

      // Only send ticket update if there are changes
      if (Object.keys(requestBody).length > 0) {
        const ticketResponse = await fetch(`${API_BASE}/tickets/${ticket.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(requestBody)
        });

        if (!ticketResponse.ok) {
          const errorData = await ticketResponse.json();
          setErrors({ submit: errorData.error || 'Error al actualizar el ticket' });
          return;
        }
      }

      // Handle menu items if the ticket includes them
      if (formData.includesMenuItem && ticket.includesMenuItem) {
        // Get current menu items to compare
        const currentMenuResponse = await fetch(`${API_BASE}/ticket-menu/${ticket.id}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        if (currentMenuResponse.ok) {
          const currentMenuItems = await currentMenuResponse.json();
          
          // For now, we'll handle this by clearing all and re-adding
          // This is a simple approach - in production you might want more sophisticated diff logic
          
          // Clear all existing menu items
          for (const item of currentMenuItems) {
            await fetch(`${API_BASE}/ticket-menu/${ticket.id}/${item.id}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
            });
          }

          // Add new menu items
          for (const menuItem of formData.menuItems) {
            await fetch(`${API_BASE}/ticket-menu/${ticket.id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(menuItem)
            });
          }
        } else {
          console.error('Failed to get current menu items:', currentMenuResponse.status);
        }
      } else if (!formData.includesMenuItem && ticket.includesMenuItem) {
        // If user disabled menu items, remove all existing ones
        const currentMenuResponse = await fetch(`${API_BASE}/ticket-menu/${ticket.id}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        if (currentMenuResponse.ok) {
          const currentMenuItems = await currentMenuResponse.json();
          
          for (const item of currentMenuItems) {
            await fetch(`${API_BASE}/ticket-menu/${ticket.id}/${item.id}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
            });
          }
        } else {
          console.error('Failed to get current menu items for deletion:', currentMenuResponse.status);
        }
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating ticket:', error);
      setErrors({ submit: 'Error de conexión' });
    } finally {
      setLoading(false);
    }
  };

  const addMenuItem = () => {
    setFormData(prev => {
      const newMenuItems = [...prev.menuItems, { categoryId: '', menuItemId: '', variantId: null, quantity: 1 }];
      return {
        ...prev,
        menuItems: newMenuItems
      };
    });
  };

  const removeMenuItem = (index: number) => {
    setFormData(prev => {
      const newMenuItems = prev.menuItems.filter((_, i) => i !== index);
      return {
        ...prev,
        menuItems: newMenuItems
      };
    });
  };

  const updateMenuItem = (index: number, field: string, value: string | number | null) => {
    setFormData(prev => {
      const newMenuItems = prev.menuItems.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      );
      return {
        ...prev,
        menuItems: newMenuItems
      };
    });
  };

  const getMenuItemsByCategory = (categoryId: string) => {
    return menuItems.filter(item => item.categoryId === categoryId);
  };

  const getSelectedMenuItem = (menuItemId: string) => {
    return menuItems.find(item => item.id === menuItemId);
  };

  const handleCategoryChange = (index: number, categoryId: string) => {
    setFormData(prev => {
      const newMenuItems = prev.menuItems.map((item, i) => 
        i === index 
          ? { ...item, categoryId, menuItemId: '', variantId: null }
          : item
      );
      return {
        ...prev,
        menuItems: newMenuItems
      };
    });
  };

  const handleMenuItemChange = (index: number, menuItemId: string) => {
    setFormData(prev => {
      const newMenuItems = prev.menuItems.map((item, i) => 
        i === index 
          ? { ...item, menuItemId, variantId: null }
          : item
      );
      return {
        ...prev,
        menuItems: newMenuItems
      };
    });
  };

  const handleClose = () => {
    setErrors({});
    onClose();
  };

  if (!isOpen || !ticket) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-w-2xl w-full my-4 sm:my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Edit3 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Actualizar Ticket
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Modifica los detalles del ticket
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-hidden">
          {/* Basic Information */}
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-900 dark:text-white">Información Básica</h4>
            
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className={`w-full px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none ${
                  errors.name ? 'border-red-500 dark:border-red-400' : 'border-gray-200 dark:border-gray-600'
                } bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white`}
                placeholder="Ej: VIP Package with Drinks"
                maxLength={500}
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                {formData.name.length}/500
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Descripción
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Descripción del ticket..."
                rows={3}
                maxLength={500}
              />
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                {formData.description.length}/500
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-900 dark:text-white">Precio y Disponibilidad</h4>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Price */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Precio *
                  </label>
                  {/* Dynamic Pricing Pill */}
                  {formData.price > 0 && (
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, dynamicPricingEnabled: !prev.dynamicPricingEnabled }))}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        formData.dynamicPricingEnabled
                          ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {formData.dynamicPricingEnabled ? '✓ Dinámico' : 'Dinámico'}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <DollarSign className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
                    ticket.price === 0 ? 'text-gray-400 dark:text-gray-400' : 'text-gray-400'
                  }`} />
                   {(() => {
                     const isFreeTicket = ticket.price === 0 || ticket.price === '0' || ticket.price === null || ticket.price === undefined;
                     
                     if (isFreeTicket) {
                         return (
                           <div className="w-full pl-10 pr-3 py-2 border-2 border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 cursor-not-allowed flex items-center">
                             <span className="text-gray-400 dark:text-gray-500">0</span>
                           </div>
                         );
                     } else {
                       return (
                     <input
                       type="text"
                       value={formData.price === 0 ? '' : formatNumber(formData.price)}
                       onChange={(e) => {
                         const value = e.target.value;
                         // Allow only numbers, dots, and commas
                         const cleanValue = value.replace(/[^0-9.,]/g, '');
                         const numericValue = parseFormattedNumber(cleanValue);
                         setFormData(prev => ({ 
                           ...prev, 
                           price: numericValue
                         }));
                       }}
                           className={`w-full pl-10 pr-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none ${
                             errors.price ? 'border-red-500 dark:border-red-400' : 'border-gray-200 dark:border-gray-600'
                           } bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white`}
                           placeholder="0"
                         />
                       );
                     }
                   })()}
                   {ticket.price === 0 && (
                     <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                       El precio no se puede cambiar para tickets gratuitos
                     </p>
                   )}
                </div>
                {errors.price && <p className="mt-1 text-sm text-red-600">{errors.price}</p>}
                {errors.dynamicPricingEnabled && <p className="mt-1 text-sm text-red-600">{errors.dynamicPricingEnabled}</p>}
              </div>

              {/* Max Per Person */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Máx por Persona *
                </label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="number"
                    value={formData.maxPerPerson}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxPerPerson: parseInt(e.target.value) || 1 }))}
                    className={`w-full pl-10 pr-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none ${
                      errors.maxPerPerson ? 'border-red-500 dark:border-red-400' : 'border-gray-200 dark:border-gray-600'
                    } bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white`}
                    placeholder="1"
                    min="1"
                  />
                </div>
                {errors.maxPerPerson && <p className="mt-1 text-sm text-red-600">{errors.maxPerPerson}</p>}
              </div>
            </div>

            {/* Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Prioridad *
                </label>
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, priority: Math.max(1, prev.priority - 1) }))}
                    className="w-8 h-8 flex items-center justify-center border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">-</span>
                  </button>
                  <div className="relative w-20">
                    <Star className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="number"
                      value={formData.priority === 0 ? '' : formData.priority}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '') {
                          setFormData(prev => ({ ...prev, priority: 0 }));
                        } else {
                          const numValue = parseInt(value);
                          if (!isNaN(numValue) && numValue >= 1) {
                            setFormData(prev => ({ ...prev, priority: numValue }));
                          }
                        }
                      }}
                      onBlur={(e) => {
                        if (e.target.value === '' || formData.priority === 0) {
                          setFormData(prev => ({ ...prev, priority: 1 }));
                        }
                      }}
                      className="w-full pl-8 pr-2 py-2 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-center"
                      min="1"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, priority: prev.priority + 1 }))}
                    className="w-8 h-8 flex items-center justify-center border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">+</span>
                  </button>
                </div>
                {errors.priority && <p className="mt-1 text-sm text-red-600">{errors.priority}</p>}
              </div>
            </div>


            {/* Event selection for event tickets */}
            {ticket.eventId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Evento
                </label>
                <select
                  value={formData.eventId || ''}
                  disabled={true}
                  className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                >
                  <option value="">Seleccionar evento...</option>
                  {events.map(event => (
                    <option key={event.id} value={event.id}>
                      {event.name} - {formatBogotaDate(event.availableDate, 'dd/MM/yyyy')}
                    </option>
                  ))}
                </select>
                {errors.eventId && <p className="mt-1 text-sm text-red-600">{errors.eventId}</p>}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  El evento no se puede cambiar una vez establecido
                </p>
              </div>
            )}
          </div>

           {/* Menu Items - Only show if ticket supports menu items */}
           {ticket && ticket.includesMenuItem && (
             <div className="space-y-4">
               <div className="flex items-center justify-between">
                 <h4 className="text-md font-medium text-gray-900 dark:text-white">Elementos del Menú</h4>
                 <div className="flex items-center space-x-2">
                   <div className={`px-4 py-2 rounded-full text-sm font-medium ${
                     'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700'
                   }`}>
                     ✓ Incluir Menú
                   </div>
                 </div>
               </div>

            {errors.includesMenuItem && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600">{errors.includesMenuItem}</p>
              </div>
            )}

            {formData.includesMenuItem && (
              <div className="space-y-4">
                {loadingMenuItems ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                    <span className="ml-3 text-gray-600 dark:text-gray-400">Cargando elementos del menú...</span>
                  </div>
                ) : menuCategories.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-gray-500 dark:text-gray-400 mb-2">
                      No hay categorías de menú disponibles
                    </div>
                    <div className="text-sm text-gray-400 dark:text-gray-500">
                      Crea categorías de menú primero para poder agregar elementos
                    </div>
                  </div>
                ) : (
                  <>
                    {formData.menuItems.map((item, index) => (
                      <div key={index} className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                        {/* Desktop: Horizontal layout */}
                        <div className="hidden md:flex items-end space-x-3">
                          {/* Category Selection */}
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Categoría *
                            </label>
                            <select
                              value={item.categoryId}
                              onChange={(e) => handleCategoryChange(index, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                              <option value="">Seleccionar categoría...</option>
                              {menuCategories.map(category => (
                                <option key={category.id} value={category.id}>
                                  {category.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Menu Item Selection */}
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Elemento del Menú *
                            </label>
                            <select
                              value={item.menuItemId}
                              onChange={(e) => handleMenuItemChange(index, e.target.value)}
                              disabled={!item.categoryId}
                              className={`w-full px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none ${
                                !item.categoryId 
                                  ? 'border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                  : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white'
                              }`}
                            >
                              <option value="">Seleccionar elemento...</option>
                              {item.categoryId && getMenuItemsByCategory(item.categoryId).map(menuItem => (
                                <option key={menuItem.id} value={menuItem.id}>
                                  {menuItem.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Variant Selection */}
                          {getSelectedMenuItem(item.menuItemId)?.variants && getSelectedMenuItem(item.menuItemId)!.variants!.length > 0 && (
                            <div className="flex-1">
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Variante
                              </label>
                              <select
                                value={item.variantId || ''}
                                onChange={(e) => updateMenuItem(index, 'variantId', e.target.value || null)}
                                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                              >
                                <option value="">Sin variante</option>
                                {getSelectedMenuItem(item.menuItemId)?.variants?.map(variant => (
                                  <option key={variant.id} value={variant.id}>
                                    {variant.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Quantity */}
                          <div className="w-32">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Cantidad
                            </label>
                            <div className="flex items-center space-x-3">
                              <button
                                type="button"
                                onClick={() => updateMenuItem(index, 'quantity', Math.max(1, item.quantity - 1))}
                                className="w-10 h-10 flex items-center justify-center border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                              >
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">-</span>
                              </button>
                              <input
                                type="number"
                                value={item.quantity === 0 ? '' : item.quantity}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value === '') {
                                    updateMenuItem(index, 'quantity', 0);
                                  } else {
                                    const numValue = parseInt(value);
                                    if (!isNaN(numValue) && numValue >= 1) {
                                      updateMenuItem(index, 'quantity', numValue);
                                    }
                                  }
                                }}
                                onBlur={(e) => {
                                  if (e.target.value === '' || item.quantity === 0) {
                                    updateMenuItem(index, 'quantity', 1);
                                  }
                                }}
                                className="w-20 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded text-center text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 focus:outline-none"
                                min="1"
                              />
                              <button
                                type="button"
                                onClick={() => updateMenuItem(index, 'quantity', item.quantity + 1)}
                                className="w-10 h-10 flex items-center justify-center border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                              >
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">+</span>
                              </button>
                            </div>
                          </div>
                          
                          {/* Remove Button */}
                          <button
                            type="button"
                            onClick={() => removeMenuItem(index)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Eliminar elemento"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Mobile: Vertical layout */}
                        <div className="md:hidden space-y-3">
                          {/* Category Selection */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Categoría *
                            </label>
                            <select
                              value={item.categoryId}
                              onChange={(e) => handleCategoryChange(index, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                              <option value="">Seleccionar categoría...</option>
                              {menuCategories.map(category => (
                                <option key={category.id} value={category.id}>
                                  {category.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Menu Item Selection */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Elemento del Menú *
                            </label>
                            <select
                              value={item.menuItemId}
                              onChange={(e) => handleMenuItemChange(index, e.target.value)}
                              disabled={!item.categoryId}
                              className={`w-full px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none ${
                                !item.categoryId 
                                  ? 'border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                  : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white'
                              }`}
                            >
                              <option value="">Seleccionar elemento...</option>
                              {item.categoryId && getMenuItemsByCategory(item.categoryId).map(menuItem => (
                                <option key={menuItem.id} value={menuItem.id}>
                                  {menuItem.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Variant Selection */}
                          {getSelectedMenuItem(item.menuItemId)?.variants && getSelectedMenuItem(item.menuItemId)!.variants!.length > 0 && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Variante
                              </label>
                              <select
                                value={item.variantId || ''}
                                onChange={(e) => updateMenuItem(index, 'variantId', e.target.value || null)}
                                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                              >
                                <option value="">Sin variante</option>
                                {getSelectedMenuItem(item.menuItemId)?.variants?.map(variant => (
                                  <option key={variant.id} value={variant.id}>
                                    {variant.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Quantity and Remove Button */}
                          <div className="flex items-end space-x-3">
                            <div className="flex-1">
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Cantidad
                              </label>
                              <div className="flex items-center space-x-1">
                                <button
                                  type="button"
                                  onClick={() => updateMenuItem(index, 'quantity', Math.max(1, item.quantity - 1))}
                                  className="w-6 h-6 flex items-center justify-center border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                >
                                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">-</span>
                                </button>
                                <input
                                  type="number"
                                  value={item.quantity === 0 ? '' : item.quantity}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value);
                                    if (!isNaN(value) && value >= 1) {
                                      updateMenuItem(index, 'quantity', value);
                                    }
                                  }}
                                  className="w-12 px-1 py-1 border border-gray-200 dark:border-gray-600 rounded text-center text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500 focus:outline-none"
                                  min="1"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateMenuItem(index, 'quantity', item.quantity + 1)}
                                  className="w-6 h-6 flex items-center justify-center border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                >
                                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">+</span>
                                </button>
                              </div>
                            </div>
                            
                            <button
                              type="button"
                              onClick={() => removeMenuItem(index)}
                              className="px-3 py-1 text-xs sm:text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                              title="Eliminar elemento"
                            >
                              <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                          </div>
                         </div>
                       </div>
                     ))}
                
                    {formData.includesMenuItem && (
                      <button
                        type="button"
                        onClick={addMenuItem}
                        disabled={menuCategories.length === 0}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors border ${
                          menuCategories.length === 0
                            ? 'text-gray-400 bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 cursor-not-allowed'
                            : 'text-white bg-purple-600 hover:bg-purple-700 border-purple-600 hover:border-purple-700'
                        }`}
                      >
                        <span>Agregar elemento del menú</span>
                      </button>
                    )}
                    
                    {errors.menuItems && <p className="text-sm text-red-600">{errors.menuItems}</p>}
                  </>
                )}
              </div>
            )}
            </div>
          )}

          {/* Submit Error */}
          {errors.submit && (
            <div className="flex items-center space-x-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !hasChanges()}
              className={`px-6 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                !hasChanges() 
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                  : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Actualizando...</span>
                </>
              ) : (
                <>
                  <Edit3 className="h-4 w-4" />
                  <span>Actualizar Ticket</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
