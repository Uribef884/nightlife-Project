'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Image, Upload, AlertCircle } from 'lucide-react';

interface UpdateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  event: {
    id: string;
    name: string;
    description?: string;
    bannerUrl?: string;
    openHours?: {
      open: string;
      close: string;
    };
  } | null;
}

interface EventFormData {
  name: string;
  description: string;
  bannerImage: File | null;
  openHours: {
    open: string;
    close: string;
  };
}

export function UpdateEventModal({ isOpen, onClose, onSuccess, event }: UpdateEventModalProps) {
  const [formData, setFormData] = useState<EventFormData>({
    name: '',
    description: '',
    bannerImage: null,
    openHours: {
      open: '',
      close: ''
    }
  });
  
  const [originalData, setOriginalData] = useState<EventFormData>({
    name: '',
    description: '',
    bannerImage: null,
    openHours: {
      open: '',
      close: ''
    }
  });
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Initialize form data when event changes
  useEffect(() => {
    if (event) {
      const initialData = {
        name: event.name || '',
        description: event.description || '',
        bannerImage: null,
        openHours: event.openHours || {
          open: '',
          close: ''
        }
      };
      setFormData(initialData);
      setOriginalData(initialData);
      setImagePreview(event.bannerUrl || null);
      setErrors({});
    }
  }, [event]);

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
      formData.openHours.open !== originalData.openHours.open ||
      formData.openHours.close !== originalData.openHours.close ||
      formData.bannerImage !== null
    );
  };

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
    
    if (!event) return;
    
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
      const updatePayload: any = {};
      
      if (formData.name !== originalData.name) {
        updatePayload.name = formData.name.trim();
      }
      
      if (formData.description !== originalData.description) {
        updatePayload.description = formData.description.trim();
      }
      
      if (formData.openHours.open !== originalData.openHours.open || 
          formData.openHours.close !== originalData.openHours.close) {
        updatePayload.openHours = formData.openHours;
      }
      
      // Only send event details update if there are changes
      if (Object.keys(updatePayload).length > 0) {
        const eventResponse = await fetch(`${API_BASE}/events/${event.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(updatePayload)
        });

        if (!eventResponse.ok) {
          const errorData = await eventResponse.json();
          setErrors({ submit: errorData.error || 'Error al actualizar el evento' });
          return;
        }
      }

      // Update banner image if a new one was selected
      if (formData.bannerImage) {
        const formDataToSend = new FormData();
        formDataToSend.append('image', formData.bannerImage);

        const imageResponse = await fetch(`${API_BASE}/events/${event.id}/image`, {
          method: 'PUT',
          credentials: 'include',
          body: formDataToSend
        });

        if (!imageResponse.ok) {
          const errorData = await imageResponse.json();
          setErrors({ submit: errorData.error || 'Error al actualizar la imagen del evento' });
          return;
        }
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating event:', error);
      setErrors({ submit: 'Error de conexión' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      description: '',
      bannerImage: null,
      openHours: {
        open: '',
        close: ''
      }
    });
    setImagePreview(null);
    setErrors({});
    onClose();
  };

  if (!isOpen || !event) return null;

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
                Actualizar Evento
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Modifica los detalles del evento
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

          {/* Banner Image */}
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-900 dark:text-white">Imagen del Banner</h4>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Imagen del Banner
              </label>
              <div className="flex items-center gap-4">
                <div className="w-32 h-24 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-600 relative">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Banner preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                      <Image className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <label className={`flex items-center gap-2 px-3 py-2 border-2 border-dashed rounded-lg transition-colors text-sm ${
                    loading 
                      ? 'border-gray-400 cursor-not-allowed opacity-50' 
                      : 'border-gray-300 dark:border-gray-600 cursor-pointer hover:border-purple-500'
                  }`}>
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                        <span className="text-gray-600 dark:text-gray-400">Subiendo...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600 dark:text-gray-400">
                          {imagePreview ? 'Cambiar imagen' : 'Subir imagen'}
                        </span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      disabled={loading}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    PNG, JPG, GIF hasta 5MB
                  </p>
                </div>
              </div>
              {errors.bannerImage && <p className="mt-1 text-sm text-red-600">{errors.bannerImage}</p>}
            </div>
          </div>

          {/* Open Hours */}
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-900 dark:text-white">Horarios del Evento</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Hora de Apertura *
                </label>
                <input
                  type="time"
                  value={formData.openHours.open}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    openHours: { ...prev.openHours, open: e.target.value }
                  }))}
                  className={`w-full px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none ${
                    errors.openHours ? 'border-red-500 dark:border-red-400' : 'border-gray-200 dark:border-gray-600'
                  } bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white`}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Hora de Cierre *
                </label>
                <input
                  type="time"
                  value={formData.openHours.close}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    openHours: { ...prev.openHours, close: e.target.value }
                  }))}
                  className={`w-full px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none ${
                    errors.openHours ? 'border-red-500 dark:border-red-400' : 'border-gray-200 dark:border-gray-600'
                  } bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white`}
                />
              </div>
            </div>
            {errors.openHours && <p className="mt-1 text-sm text-red-600">{errors.openHours}</p>}
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
                  <Calendar className="h-4 w-4" />
                  <span>Actualizar Evento</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
