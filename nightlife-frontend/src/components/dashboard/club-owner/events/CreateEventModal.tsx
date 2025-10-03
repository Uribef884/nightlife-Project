'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Clock, Image, AlertCircle } from 'lucide-react';
import { isPastDateInBogota, todayInBogota } from '@/utils/timezone';
import NextImage from 'next/image';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clubId: string;
}

interface EventFormData {
  name: string;
  description: string;
  availableDate: string;
  openHours: {
    open: string;
    close: string;
  };
  bannerImage: File | null;
}

export function CreateEventModal({ isOpen, onClose, onSuccess }: CreateEventModalProps) {
  const [formData, setFormData] = useState<EventFormData>({
    name: '',
    description: '',
    availableDate: '',
    openHours: {
      open: '22:00',
      close: '02:00'
    },
    bannerImage: null
  });
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imagePreview, setImagePreview] = useState<string | null>(null);

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

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    } else if (formData.name.length > 200) {
      newErrors.name = 'El nombre no puede exceder 200 caracteres';
    }

    // Description validation
    if (!formData.description.trim()) {
      newErrors.description = 'La descripción es requerida';
    } else if (formData.description.length > 1000) {
      newErrors.description = 'La descripción no puede exceder 1000 caracteres';
    }

    // Date validation
    if (!formData.availableDate) {
      newErrors.availableDate = 'La fecha es requerida';
    } else {
      if (isPastDateInBogota(formData.availableDate)) {
        newErrors.availableDate = 'La fecha no puede ser en el pasado';
      }
    }

    // Open hours validation
    if (!formData.openHours.open) {
      newErrors.openHours = 'La hora de apertura es requerida';
    } else if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(formData.openHours.open)) {
      newErrors.openHours = 'Formato de hora inválido (HH:MM)';
    }

    if (!formData.openHours.close) {
      newErrors.openHours = 'La hora de cierre es requerida';
    } else if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(formData.openHours.close)) {
      newErrors.openHours = 'Formato de hora inválido (HH:MM)';
    }

    // Banner image validation
    if (!formData.bannerImage) {
      newErrors.bannerImage = 'La imagen del banner es requerida';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, bannerImage: 'Solo se permiten archivos de imagen' }));
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, bannerImage: 'La imagen no puede exceder 5MB' }));
        return;
      }

      setFormData(prev => ({ ...prev, bannerImage: file }));
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Clear error
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.bannerImage;
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
      
      // Create FormData for multipart/form-data request
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name.trim());
      formDataToSend.append('description', formData.description.trim());
      formDataToSend.append('availableDate', formData.availableDate);
      formDataToSend.append('openHours', JSON.stringify(formData.openHours));
      if (formData.bannerImage) {
        formDataToSend.append('image', formData.bannerImage);
      }

      const response = await fetch(`${API_BASE}/events`, {
        method: 'POST',
        credentials: 'include',
        body: formDataToSend
      });

      if (!response.ok) {
        const errorData = await response.json();
        setErrors({ submit: errorData.error || 'Error al crear el evento' });
        return;
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating event:', error);
      setErrors({ submit: 'Error de conexión' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      description: '',
      availableDate: '',
      openHours: {
        open: '22:00',
        close: '02:00'
      },
      bannerImage: null
    });
    setImagePreview(null);
    setErrors({});
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
              <Calendar className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Crear Evento
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Planifica un nuevo evento para tu club
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
                Nombre del Evento *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className={`w-full px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none ${
                  errors.name ? 'border-red-500 dark:border-red-400' : 'border-gray-200 dark:border-gray-600'
                } bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white`}
                placeholder="Nombre del evento"
                maxLength={200}
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                {formData.name.length}/200
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Descripción *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className={`w-full px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none ${
                  errors.description ? 'border-red-500 dark:border-red-400' : 'border-gray-200 dark:border-gray-600'
                } bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white`}
                placeholder="Describe el evento..."
                rows={4}
                maxLength={1000}
              />
              {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                {formData.description.length}/1000
              </div>
            </div>
          </div>

          {/* Date and Time */}
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-900 dark:text-white">Fecha y Horario</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Fecha del Evento *
                </label>
                <div className="relative overflow-hidden">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none z-10" />
                  <input
                    type="date"
                    value={formData.availableDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, availableDate: e.target.value }))}
                    className={`w-full pl-10 pr-3 py-3 sm:py-2 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none text-sm sm:text-base ${
                      errors.availableDate ? 'border-red-500 dark:border-red-400' : 'border-gray-200 dark:border-gray-600'
                    } bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white`}
                    min={todayInBogota()}
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

              {/* Open Hours */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Horario *
                </label>
                <div className="flex items-center space-x-2">
                  <div className="flex-1">
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="time"
                        value={formData.openHours.open}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          openHours: { ...prev.openHours, open: e.target.value }
                        }))}
                        className={`w-full pl-10 pr-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none ${
                          errors.openHours ? 'border-red-500 dark:border-red-400' : 'border-gray-200 dark:border-gray-600'
                        } bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white`}
                      />
                    </div>
                  </div>
                  <span className="text-gray-500 dark:text-gray-400">-</span>
                  <div className="flex-1">
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="time"
                        value={formData.openHours.close}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          openHours: { ...prev.openHours, close: e.target.value }
                        }))}
                        className={`w-full pl-10 pr-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none ${
                          errors.openHours ? 'border-red-500 dark:border-red-400' : 'border-gray-200 dark:border-gray-600'
                        } bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white`}
                      />
                    </div>
                  </div>
                </div>
                {errors.openHours && <p className="mt-1 text-sm text-red-600">{errors.openHours}</p>}
              </div>
            </div>
          </div>

          {/* Banner Image */}
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-900 dark:text-white">Imagen del Banner</h4>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Imagen del Banner *
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
                <div className="space-y-1 text-center">
                  {imagePreview ? (
                    <div className="space-y-2">
                      <NextImage
                        src={imagePreview}
                        alt="Event banner preview"
                        width={128}
                        height={128}
                        className="mx-auto rounded-lg object-cover"
                      />
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {formData.bannerImage?.name}
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* eslint-disable-next-line jsx-a11y/alt-text */}
                      <Image className="mx-auto h-12 w-12 text-gray-400" aria-hidden="true" />
                      <div className="flex text-sm text-gray-600 dark:text-gray-400">
                        <label
                          htmlFor="banner-image"
                          className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-purple-600 hover:text-purple-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-purple-500"
                        >
                          <span>Subir imagen</span>
                          <input
                            id="banner-image"
                            name="banner-image"
                            type="file"
                            className="sr-only"
                            accept="image/*"
                            onChange={handleImageChange}
                          />
                        </label>
                        <p className="pl-1">o arrastra y suelta</p>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        PNG, JPG, GIF hasta 5MB
                      </p>
                    </>
                  )}
                </div>
              </div>
              {errors.bannerImage && <p className="mt-1 text-sm text-red-600">{errors.bannerImage}</p>}
            </div>
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
                  <Calendar className="h-4 w-4" />
                  <span>Crear Evento</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
