'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Calendar, DollarSign, Users, Star, Gift, Ticket, AlertCircle, Trash2 } from 'lucide-react';
import { formatBogotaDate, maxSelectableDateInBogota, isPastDateInBogota } from '@/utils/timezone';

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

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
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

const initialFormData: TicketFormData = {
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
};

export function CreateTicketModal({ isOpen, onClose, onSuccess, clubId, events = [] }: CreateTicketModalProps) {
  const [formData, setFormData] = useState<TicketFormData>(initialFormData);
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

  // Load menu items when modal opens and clear form
  useEffect(() => {
    if (isOpen) {
      setFormData(initialFormData);
      setErrors({});
      loadMenuItems();
      
      // iOS detection and scroll lock
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        // Store current scroll position
        const scrollY = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';
      } else {
        document.body.style.overflow = 'hidden';
      }
    } else {
      // Restore scrolling when modal is closed
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

    // Cleanup function to restore scrolling if component unmounts
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
  }, [isOpen, clubId, loadMenuItems]);

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

    // Category-specific validations
    if (formData.category === 'general') {
      if (formData.price <= 0) {
        newErrors.price = 'Los tickets generales deben tener precio mayor a 0';
      }
      if (formData.availableDate) {
        newErrors.availableDate = 'Los tickets generales no pueden tener fecha';
      }
      if (formData.quantity !== null) {
        newErrors.quantity = 'Los tickets generales no pueden tener cantidad';
      }
      if (formData.eventId) {
        newErrors.eventId = 'Los tickets generales no pueden tener evento';
      }
    }

    if (formData.category === 'free') {
      if (formData.price !== 0) {
        newErrors.price = 'Los tickets gratuitos deben tener precio 0';
      }
      if (!formData.availableDate) {
        newErrors.availableDate = 'Los tickets gratuitos requieren fecha';
      } else {
        if (isPastDateInBogota(formData.availableDate)) {
          newErrors.availableDate = 'La fecha no puede ser en el pasado';
        }
      }
      if (!formData.quantity || formData.quantity <= 0) {
        newErrors.quantity = 'Los tickets gratuitos requieren cantidad mayor a 0';
      }
      if (formData.eventId) {
        newErrors.eventId = 'Los tickets gratuitos no pueden tener evento';
      }
      if (formData.dynamicPricingEnabled) {
        newErrors.dynamicPricingEnabled = 'Los tickets gratuitos no pueden tener precio dinámico';
      }
    }

    if (formData.category === 'event') {
      if (formData.price < 0) {
        newErrors.price = 'El precio no puede ser negativo';
      }
      if (!formData.eventId) {
        newErrors.eventId = 'Los tickets de evento requieren un evento';
      }
      if (!formData.quantity || formData.quantity <= 0) {
        newErrors.quantity = 'Los tickets de evento requieren cantidad mayor a 0';
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
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
      
      // Prepare the request body based on category
      const requestBody: Record<string, unknown> = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: formData.price,
        maxPerPerson: formData.maxPerPerson,
        priority: formData.priority,
        category: formData.category,
        dynamicPricingEnabled: formData.dynamicPricingEnabled,
        includesMenuItem: formData.includesMenuItem
      };

      // Add category-specific fields
      if (formData.category === 'free') {
        requestBody.quantity = formData.quantity;
        requestBody.availableDate = formData.availableDate;
      } else if (formData.category === 'event') {
        requestBody.quantity = formData.quantity;
        requestBody.eventId = formData.eventId;
      }

      // Add menu items if included
      if (formData.includesMenuItem && formData.menuItems.length > 0) {
        requestBody.menuItems = formData.menuItems;
      }

      const response = await fetch(`${API_BASE}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        onSuccess();
        clearForm();
        onClose();
      } else {
        const errorData = await response.json();
        setErrors({ submit: errorData.error || 'Error al crear el ticket' });
      }
    } catch {
      setErrors({ submit: 'Error de conexión' });
    } finally {
      setLoading(false);
    }
  };

  const handleTicketCategoryChange = (category: 'general' | 'event' | 'free') => {
    setFormData(prev => ({
      ...prev,
      category,
      // Reset category-specific fields
      price: category === 'free' ? 0 : prev.price,
      quantity: category === 'general' ? null : (prev.quantity || 100),
      availableDate: category === 'general' ? null : prev.availableDate,
      eventId: category === 'general' || category === 'free' ? null : prev.eventId,
      dynamicPricingEnabled: category === 'free' ? false : prev.dynamicPricingEnabled,
      // Clear menu items when switching categories
      includesMenuItem: false,
      menuItems: []
    }));
  };

  const addMenuItem = () => {
    setFormData(prev => ({
      ...prev,
      menuItems: [...prev.menuItems, { categoryId: '', menuItemId: '', variantId: null, quantity: 1 }]
    }));
  };

  const removeMenuItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      menuItems: prev.menuItems.filter((_, i) => i !== index)
    }));
  };

  const updateMenuItem = (index: number, field: string, value: string | number | null) => {
    setFormData(prev => ({
      ...prev,
      menuItems: prev.menuItems.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const getMenuItemsByCategory = (categoryId: string) => {
    return menuItems.filter(item => item.categoryId === categoryId);
  };

  const getSelectedMenuItem = (menuItemId: string) => {
    return menuItems.find(item => item.id === menuItemId);
  };

  const handleCategoryChange = (index: number, categoryId: string) => {
    setFormData(prev => ({
      ...prev,
      menuItems: prev.menuItems.map((item, i) => 
        i === index 
          ? { ...item, categoryId, menuItemId: '', variantId: null }
          : item
      )
    }));
  };

  const handleMenuItemChange = (index: number, menuItemId: string) => {
    setFormData(prev => ({
      ...prev,
      menuItems: prev.menuItems.map((item, i) => 
        i === index 
          ? { ...item, menuItemId, variantId: null }
          : item
      )
    }));
  };

  const clearForm = () => {
    setFormData(initialFormData);
    setErrors({});
  };

  const handleClose = () => {
    clearForm();
    onClose();
  };

  if (!isOpen) return null;

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
              <Ticket className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Crear Ticket
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Configura los detalles del nuevo ticket
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
                placeholder="Nombre del ticket"
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

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Categoría *
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'general', label: 'General', icon: Ticket, description: 'Covers regulares' },
                  { value: 'event', label: 'Evento', icon: Calendar, description: 'Para eventos específicos' },
                  { value: 'free', label: 'Gratuito', icon: Gift, description: 'Acceso gratuito' }
                ].map(({ value, label, icon: Icon, description }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleTicketCategoryChange(value as 'general' | 'event' | 'free')}
                    className={`p-3 border-2 rounded-lg text-left transition-colors ${
                      formData.category === value
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-400'
                    }`}
                  >
                    <Icon className="h-5 w-5 mb-2 text-gray-600 dark:text-gray-400" />
                    <div className="font-medium text-sm text-gray-900 dark:text-white">{label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{description}</div>
                  </button>
                ))}
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
                  {formData.category !== 'free' && (
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
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
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
                    } ${
                      formData.category === 'free' 
                        ? 'bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed' 
                        : 'bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white'
                    }`}
                    placeholder="0"
                    disabled={formData.category === 'free'}
                    readOnly={formData.category === 'free'}
                  />
                </div>
                {errors.price && <p className="mt-1 text-sm text-red-600">{errors.price}</p>}
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

            {/* Priority and Quantity */}
            <div className="grid grid-cols-2 gap-4">
              {/* Priority */}
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

              {/* Quantity for free/event tickets */}
              {(formData.category === 'free' || formData.category === 'event') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Existencias *
                  </label>
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, quantity: Math.max(1, (prev.quantity || 100) - 1) }))}
                      className="w-8 h-8 flex items-center justify-center border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-300">-</span>
                    </button>
                    <input
                      type="number"
                      value={formData.quantity === 0 ? '' : (formData.quantity || '')}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '') {
                          setFormData(prev => ({ ...prev, quantity: 0 }));
                        } else {
                          const numValue = parseInt(value);
                          if (!isNaN(numValue) && numValue >= 1) {
                            setFormData(prev => ({ ...prev, quantity: numValue }));
                          }
                        }
                      }}
                      onBlur={(e) => {
                        if (e.target.value === '' || formData.quantity === 0) {
                          setFormData(prev => ({ ...prev, quantity: 100 }));
                        }
                      }}
                      className="w-20 px-3 py-2 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-center"
                      placeholder="100"
                      min="1"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, quantity: (prev.quantity || 100) + 1 }))}
                      className="w-8 h-8 flex items-center justify-center border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-300">+</span>
                    </button>
                  </div>
                  {errors.quantity && <p className="mt-1 text-sm text-red-600">{errors.quantity}</p>}
                </div>
              )}
            </div>

            {/* Available Date for free tickets */}
            {formData.category === 'free' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Fecha Disponible *
                </label>
                <div className="relative overflow-hidden">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none z-10" />
                  <input
                    type="date"
                    value={formData.availableDate || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, availableDate: e.target.value }))}
                    className={`w-full pl-10 pr-3 py-3 sm:py-2 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none text-sm sm:text-base ${
                      errors.availableDate ? 'border-red-500 dark:border-red-400' : 'border-gray-200 dark:border-gray-600'
                    } bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white`}
                    min={formatBogotaDate(new Date().toISOString().split('T')[0], 'yyyy-MM-dd')}
                    max={maxSelectableDateInBogota()}
                    style={{
                      colorScheme: 'dark',
                      WebkitAppearance: 'none',
                      MozAppearance: 'textfield',
                      maxWidth: '100%',
                      boxSizing: 'border-box',
                      width: '100%',
                      minHeight: '44px', // iOS minimum touch target
                      color: formData.availableDate ? 'inherit' : 'transparent',
                      textIndent: formData.availableDate ? '0' : '-9999px'
                    }}
                  />
                  {!formData.availableDate && (
                    <div className="absolute left-10 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm pointer-events-none select-none">
                      MM/DD/YY
                    </div>
                  )}
                </div>
                {errors.availableDate && <p className="mt-1 text-sm text-red-600">{errors.availableDate}</p>}
              </div>
            )}

            {/* Event selection for event tickets */}
            {formData.category === 'event' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Evento *
                </label>
                <select
                  value={formData.eventId || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, eventId: e.target.value || null }))}
                  className={`w-full px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none ${
                    errors.eventId ? 'border-red-500 dark:border-red-400' : 'border-gray-200 dark:border-gray-600'
                  } bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white`}
                >
                  <option value="">Seleccionar evento...</option>
                  {events.map(event => (
                    <option key={event.id} value={event.id}>
                      {event.name} - {formatBogotaDate(event.availableDate, 'dd/MM/yyyy')}
                    </option>
                  ))}
                </select>
                {errors.eventId && <p className="mt-1 text-sm text-red-600">{errors.eventId}</p>}
              </div>
            )}

          </div>

          {/* Menu Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-md font-medium text-gray-900 dark:text-white">Elementos del Menú</h4>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const newIncludesMenuItem = !formData.includesMenuItem;
                    setFormData(prev => ({
                      ...prev,
                      includesMenuItem: newIncludesMenuItem,
                      menuItems: newIncludesMenuItem 
                        ? [{ categoryId: '', menuItemId: '', variantId: null, quantity: 1 }]
                        : []
                    }));
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    formData.includesMenuItem
                      ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {formData.includesMenuItem ? '✓ Incluir Menú' : 'Incluir Menú'}
                </button>
              </div>
            </div>

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

                          {/* Variant Selection - Only show if item has variants */}
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

                          {/* Variant Selection - Only show if item has variants */}
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
                        <Plus className="h-4 w-4" />
                        <span>Agregar elemento del menú</span>
                      </button>
                    )}
                    
                    {errors.menuItems && <p className="text-sm text-red-600">{errors.menuItems}</p>}
                  </>
                )}
              </div>
            )}
          </div>

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
              disabled={loading}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg transition-colors flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Creando...</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span>Crear Ticket</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
