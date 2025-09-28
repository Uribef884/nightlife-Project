'use client';

import { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { Edit2, Save, X, Upload, MapPin, Clock, Music, Users, Instagram, MessageCircle, Plus, Trash2, Link, Home } from 'lucide-react';
import { UnsavedChangesProvider } from '@/components/common/UnsavedChangesProvider';

interface ClubProfileFormProps {
  clubId: string;
  onImageUploaded?: () => void; // Callback to notify parent when image is uploaded
}

interface FormData {
  name: string;
  description: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  googleMapsUrl: string;
  musicType: string[];
  openDays: string[];
  openHours: Array<{ day: string; open: string; close: string }>;
  instagram: string;
  whatsapp: string;
  dressCode: string;
  minimumAge: number | null;
  profileImage: File | null;
  profileImageUrl: string | null;
  extraInfo: string;
}

interface ClubData {
  id: string;
  name: string;
  description: string;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  googleMaps: string;
  musicType: string[];
  openDays: string[];
  openHours: Array<{ day: string; open: string; close: string }>;
  instagram: string;
  whatsapp: string;
  dressCode: string;
  minimumAge: number | null;
  profileImageUrl: string | null;
  extraInfo: string;
}

const initialFormData: FormData = {
  name: '',
  description: '',
  address: '',
  latitude: null,
  longitude: null,
  googleMapsUrl: '',
  musicType: [],
  openDays: [],
  openHours: [],
  instagram: '',
  whatsapp: '',
  dressCode: '',
  minimumAge: null,
  profileImage: null,
  profileImageUrl: null,
  extraInfo: '',
};

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Spanish day names for display
const dayTranslations: { [key: string]: string } = {
  'Monday': 'Lunes',
  'Tuesday': 'Martes', 
  'Wednesday': 'Miércoles',
  'Thursday': 'Jueves',
  'Friday': 'Viernes',
  'Saturday': 'Sábado',
  'Sunday': 'Domingo'
};

export function ClubProfileForm({ clubId, onImageUploaded }: ClubProfileFormProps) {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [originalData, setOriginalData] = useState<FormData>(initialFormData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [newMusicGenre, setNewMusicGenre] = useState('');
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false);

  // Fetch club data
  useEffect(() => {
    const fetchClubData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`http://localhost:4000/clubs/${clubId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch club data');
        }

        const clubData: ClubData = await response.json();
        
        // Convert API data to form data format
        const convertedFormData: FormData = {
          name: clubData.name || '',
          description: clubData.description || '',
          address: clubData.address || '',
          latitude: clubData.latitude,
          longitude: clubData.longitude,
          googleMapsUrl: clubData.googleMaps || '',
          musicType: clubData.musicType || [],
          openDays: clubData.openDays || [],
          openHours: convertOpenHoursToFormFormat(clubData.openHours),
          instagram: clubData.instagram || '',
          whatsapp: clubData.whatsapp || '',
          dressCode: clubData.dressCode || '',
          minimumAge: clubData.minimumAge,
          profileImage: null,
          profileImageUrl: clubData.profileImageUrl,
          extraInfo: clubData.extraInfo || '',
        };

        setFormData(convertedFormData);
        setOriginalData(convertedFormData); // Store original data for comparison
      } catch (err) {
        console.error('Error fetching club data:', err);
        setError('Error al cargar los datos del club');
      } finally {
        setLoading(false);
      }
    };

    if (clubId) {
      fetchClubData();
    }
  }, [clubId]);

  // Check if form has changes
  const hasChanges = () => {
    return JSON.stringify(formData) !== JSON.stringify(originalData);
  };

  // Helper function to determine if name field should show as invalid
  const isNameInvalid = hasTriedSubmit && (!formData.name || formData.name.trim() === '');

  // Convert API openHours format to form format
  const convertOpenHoursToFormFormat = (apiOpenHours: Array<{ day: string; open: string; close: string }>): Array<{ day: string; open: string; close: string }> => {
    if (apiOpenHours && Array.isArray(apiOpenHours)) {
      return apiOpenHours.map(hour => ({
        day: hour.day,
        open: hour.open || '',
        close: hour.close || '',
      }));
    }
    return [];
  };

  // Convert form openHours format to API format
  const convertOpenHoursToApiFormat = (formOpenHours: Array<{ day: string; open: string; close: string }>): Array<{ day: string; open: string; close: string }> => {
    return formOpenHours.filter(hours => hours.open && hours.close);
  };

  const handleSave = async () => {
    setHasTriedSubmit(true);
    
    // Validate required fields
    if (!formData.name || formData.name.trim() === '') {
      setError('El nombre del club es requerido');
      setSaving(false);
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Only send fields that have changed
      const updateData: any = {};
      
      if (formData.name !== originalData.name) updateData.name = formData.name;
      if (formData.description !== originalData.description) updateData.description = formData.description;
      if (formData.address !== originalData.address) updateData.address = formData.address;
      if (formData.latitude !== originalData.latitude) updateData.latitude = formData.latitude;
      if (formData.longitude !== originalData.longitude) updateData.longitude = formData.longitude;
      if (formData.googleMapsUrl !== originalData.googleMapsUrl) updateData.googleMaps = formData.googleMapsUrl;
      if (JSON.stringify(formData.musicType) !== JSON.stringify(originalData.musicType)) updateData.musicType = formData.musicType;
      if (JSON.stringify(formData.openDays) !== JSON.stringify(originalData.openDays)) updateData.openDays = formData.openDays;
      if (JSON.stringify(convertOpenHoursToApiFormat(formData.openHours)) !== JSON.stringify(convertOpenHoursToApiFormat(originalData.openHours))) {
        updateData.openHours = convertOpenHoursToApiFormat(formData.openHours);
      }
      if (formData.instagram !== originalData.instagram) updateData.instagram = formData.instagram;
      if (formData.whatsapp !== originalData.whatsapp) updateData.whatsapp = formData.whatsapp;
      if (formData.dressCode !== originalData.dressCode) updateData.dressCode = formData.dressCode;
      if (formData.minimumAge !== originalData.minimumAge) updateData.minimumAge = formData.minimumAge;
      if (formData.extraInfo !== originalData.extraInfo) updateData.extraInfo = formData.extraInfo;

      // If no changes, don't send request
      if (Object.keys(updateData).length === 0) {
        console.log('No changes detected');
        return;
      }

      console.log('Sending only changed fields:', updateData);

      // Update club data
      const response = await fetch('http://localhost:4000/clubs/my-club', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update club');
      }

      // Note: Image upload is handled separately in handleImageUpload

      // Update original data to current form data after successful save
      setOriginalData(formData);
      setHasTriedSubmit(false); // Clear validation state on successful save
      console.log('Club profile updated successfully');
    } catch (err) {
      console.error('Error updating club profile:', err);
      setError(err instanceof Error ? err.message : 'Error al actualizar el perfil del club');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form data to original values
    setFormData(originalData);
  };

  // Function to parse Google Maps URL and extract coordinates
  const parseGoogleMapsUrl = (url: string): { latitude: number | null; longitude: number | null; error?: string } => {
    if (!url) return { latitude: null, longitude: null };

    // Check for short URLs that don't contain coordinates
    const shortUrlPatterns = [
      /^https?:\/\/maps\.app\.goo\.gl\//,
      /^https?:\/\/goo\.gl\/maps\//,
      /^https?:\/\/bit\.ly\//,
      /^https?:\/\/tinyurl\.com\//,
      /^https?:\/\/short\.link\//
    ];

    const isShortUrl = shortUrlPatterns.some(pattern => pattern.test(url));
    if (isShortUrl) {
      return { 
        latitude: null, 
        longitude: null, 
        error: 'URLs cortas no contienen coordenadas. Use la URL completa de Google Maps.' 
      };
    }

    try {
      // Handle different Google Maps URL formats
      // Format 1: https://maps.google.com/maps?q=lat,lng
      // Format 2: https://www.google.com/maps/place/name/@lat,lng,zoom
      // Format 3: https://maps.google.com/?q=lat,lng
      // Format 4: https://www.google.com/maps/@lat,lng,zoom
      // Format 5: https://maps.google.com/maps?q=lat,lng&z=zoom
      
      let latitude: number | null = null;
      let longitude: number | null = null;

      // Try to extract coordinates from !3d and !4d format (most accurate for Google Maps place URLs)
      const d3d4Match = url.match(/!3d(-?\d+\.?\d*).*!4d(-?\d+\.?\d*)/);
      if (d3d4Match) {
        latitude = parseFloat(d3d4Match[1]);
        longitude = parseFloat(d3d4Match[2]);
      } else {
        // Try to extract coordinates from @lat,lng format (less accurate)
        const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
        if (atMatch) {
          latitude = parseFloat(atMatch[1]);
          longitude = parseFloat(atMatch[2]);
        } else {
          // Try to extract from q=lat,lng format
          const qMatch = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
          if (qMatch) {
            latitude = parseFloat(qMatch[1]);
            longitude = parseFloat(qMatch[2]);
          } else {
            // Try to extract from ll=lat,lng format
            const llMatch = url.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
            if (llMatch) {
              latitude = parseFloat(llMatch[1]);
              longitude = parseFloat(llMatch[2]);
            } else {
              // Try to extract from center=lat,lng format
              const centerMatch = url.match(/[?&]center=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
              if (centerMatch) {
                latitude = parseFloat(centerMatch[1]);
                longitude = parseFloat(centerMatch[2]);
              }
            }
          }
        }
      }

      // Validate coordinates
      if (latitude !== null && longitude !== null && 
          latitude >= -90 && latitude <= 90 && 
          longitude >= -180 && longitude <= 180) {
        return { latitude, longitude };
      }
    } catch (error) {
      console.error('Error parsing Google Maps URL:', error);
    }

    return { latitude: null, longitude: null };
  };

  const handleInputChange = (field: string, value: any) => {
    // Apply character limits
    const limits: { [key: string]: number } = {
      name: 500,
      address: 500,
      instagram: 500,
      whatsapp: 500,
      googleMapsUrl: 500,
      description: 1000,
      dressCode: 500,
      extraInfo: 500,
    };

    if (typeof value === 'string' && limits[field] && value.length > limits[field]) {
      return; // Don't update if exceeding limit
    }

    setFormData(prev => {
      const newFormData = {
        ...prev,
        [field]: value
      };

      // If Google Maps URL is being updated, try to parse coordinates
      if (field === 'googleMapsUrl' && typeof value === 'string') {
        // Check for short URLs and block them completely
        const shortUrlPatterns = [
          /^https?:\/\/maps\.app\.goo\.gl\//,
          /^https?:\/\/goo\.gl\/maps\//,
          /^https?:\/\/bit\.ly\//,
          /^https?:\/\/tinyurl\.com\//,
          /^https?:\/\/short\.link\//
        ];

        const isShortUrl = shortUrlPatterns.some(pattern => pattern.test(value));
        if (isShortUrl) {
          setError('URLs cortas no están permitidas. Use la URL completa de Google Maps.');
          return prev; // Return previous state without updating
        }

        const result = parseGoogleMapsUrl(value);
        
        if (result.latitude !== null && result.longitude !== null) {
          newFormData.latitude = result.latitude;
          newFormData.longitude = result.longitude;
          setError(''); // Clear any previous errors
        } else {
          setError(''); // Clear any previous errors
        }
      }

      // If openDays is being updated, sync with openHours
      if (field === 'openDays') {
        const selectedDays = value as string[];
        const currentOpenHours = newFormData.openHours;
        
        // Remove hours for unselected days
        const updatedOpenHours = currentOpenHours.filter(hours => 
          selectedDays.includes(hours.day)
        );
        
        // Add default hours for newly selected days that don't have hours yet
        selectedDays.forEach(day => {
          if (!updatedOpenHours.some(hours => hours.day === day)) {
            updatedOpenHours.push({
              day,
              open: '12:00',
              close: '04:00'
            });
          }
        });
        newFormData.openHours = updatedOpenHours;
      }

      return newFormData;
    });
  };

  const handleAddMusicGenre = () => {
    if (newMusicGenre.trim()) {
      // Capitalize first letter of the genre
      const capitalizedGenre = newMusicGenre.trim().charAt(0).toUpperCase() + newMusicGenre.trim().slice(1).toLowerCase();
      
      // Check if the capitalized version already exists
      if (!formData.musicType.includes(capitalizedGenre)) {
        setFormData(prev => ({
          ...prev,
          musicType: [...prev.musicType, capitalizedGenre]
        }));
        setNewMusicGenre('');
      }
    }
  };

  const handleRemoveMusicGenre = (genreToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      musicType: prev.musicType.filter(genre => genre !== genreToRemove)
    }));
  };

  const handleMusicGenreKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddMusicGenre();
    }
  };

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      setError(null);

      // Create FormData for upload
      const formDataImage = new FormData();
      formDataImage.append('image', file);

      // Upload image
      const response = await fetch('http://localhost:4000/upload/club/profile-image', {
        method: 'POST',
        credentials: 'include',
        body: formDataImage,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload image');
      }

      const imageData = await response.json();

      // Update form data with new image URL
      const newFormData = {
        ...formData,
        profileImage: null, // Clear the file after upload
        profileImageUrl: imageData.imageUrl,
      };

      setFormData(newFormData);
      
      // Update original data to prevent save button from appearing
      setOriginalData(prev => ({
        ...prev,
        profileImageUrl: imageData.imageUrl,
      }));

      // Trigger refresh of ClubSelector
      setRefreshTrigger(prev => prev + 1);
      
      // Notify parent component
      if (onImageUploaded) {
        onImageUploaded();
      }

      console.log('Image uploaded successfully:', imageData.imageUrl);
    } catch (err) {
      console.error('Error uploading image:', err);
      setError(err instanceof Error ? err.message : 'Error al subir la imagen');
    } finally {
      setUploadingImage(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Cargando datos del club...</p>
        </div>
      </div>
    );
  }


  // Check if there are unsaved changes
  const hasUnsavedChanges = hasChanges();

  // Handle save changes
  const handleSaveChanges = async () => {
    await handleSave();
  };

  // Handle discard changes
  const handleDiscardChanges = () => {
    setFormData(originalData);
    setHasTriedSubmit(false);
  };

  return (
    <UnsavedChangesProvider
      hasUnsavedChanges={hasUnsavedChanges}
      onSave={handleSaveChanges}
      onDiscard={handleDiscardChanges}
      shouldBlockNavigation={(pathname) => {
        // Only block navigation within the club owner dashboard
        return pathname.startsWith('/dashboard/club-owner');
      }}
    >
      <div className="space-y-6">
      {/* Error Display - Show inline with form */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Action Buttons - Only show when there are changes */}
      {hasChanges() && (
        <div className="flex justify-end">
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || isNameInvalid}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-4 h-4" />
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="space-y-6">
          {/* Basic Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border-2 border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Home className="w-5 h-5" />
              Información Básica
            </h3>
            <div className="space-y-4">
              {/* Profile Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Imagen del Perfil
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-600 relative">
                    {uploadingImage ? (
                      <div className="w-full h-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                      </div>
                    ) : formData.profileImageUrl ? (
                      <img
                        src={formData.profileImageUrl}
                        alt="Club profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                        <Users className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className={`flex items-center gap-2 px-3 py-2 border-2 border-dashed rounded-lg transition-colors text-sm ${
                      uploadingImage 
                        ? 'border-gray-400 cursor-not-allowed opacity-50' 
                        : 'border-gray-300 dark:border-gray-600 cursor-pointer hover:border-purple-500'
                    }`}>
                      {uploadingImage ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                          <span className="text-gray-600 dark:text-gray-400">Subiendo...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600 dark:text-gray-400">Subir Imagen</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nombre del Club *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  maxLength={500}
                  required
                  className={`w-full px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none bg-gray-50 dark:bg-gray-700 ${
                    isNameInvalid 
                      ? 'border-red-500 dark:border-red-400' 
                      : 'border-gray-200 dark:border-gray-600'
                  }`}
                />
                <div className="flex justify-between items-center mt-1">
                  {isNameInvalid && (
                    <span className="text-xs text-red-500 dark:text-red-400">
                      El nombre del club es requerido
                    </span>
                  )}
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formData.name.length}/500
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Descripción
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={Math.max(3, Math.ceil(formData.description.length / 50))}
                  maxLength={1000}
                  className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none bg-gray-50 dark:bg-gray-700 resize-none"
                />
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                  {formData.description.length}/1000
                </div>
              </div>
            </div>
          </div>

          {/* Location & Coordinates */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border-2 border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Ubicación y Coordenadas
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Dirección *
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  rows={Math.max(1, Math.ceil(formData.address.length / 60))}
                  maxLength={500}
                  className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none bg-gray-50 dark:bg-gray-700 resize-none"
                />
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                  {formData.address.length}/500
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  URL de Google Maps
                </label>
                <input
                  type="url"
                  value={formData.googleMapsUrl}
                  onChange={(e) => handleInputChange('googleMapsUrl', e.target.value)}
                  maxLength={500}
                  placeholder="https://maps.google.com/maps?q=6.241569744836635,-75.58751893290165"
                  className={`w-full px-3 py-2 border-2 rounded-lg focus:ring-2 focus:outline-none ${
                    error && formData.googleMapsUrl 
                      ? 'border-red-500 focus:ring-red-500 bg-red-50 dark:bg-red-900/20' 
                      : 'border-gray-200 dark:border-gray-600 focus:ring-purple-500 focus:border-purple-500 bg-gray-50 dark:bg-gray-700'
                  }`}
                />
                <div className="flex justify-between items-center mt-1">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formData.googleMapsUrl && formData.latitude !== null && formData.longitude !== null ? (
                      <span className="text-green-600 dark:text-green-400">
                        ✓ Coordenadas extraídas: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                      </span>
                    ) : formData.googleMapsUrl && error ? (
                      <span className="text-red-600 dark:text-red-400">
                        ⚠️ {error}
                      </span>
                    ) : (
                      <span>Las coordenadas se extraerán automáticamente de la URL completa</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formData.googleMapsUrl.length}/500
                  </div>
                </div>
                {formData.googleMapsUrl && error && (
                  <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div className="flex items-start gap-2">
                      <div className="text-amber-600 dark:text-amber-400 mt-0.5">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="text-sm text-amber-800 dark:text-amber-200">
                        <p className="font-medium mb-1">¿Cómo obtener la URL completa?</p>
                        <ol className="list-decimal list-inside space-y-1 text-xs">
                          <li>En Google Maps, busca tu ubicación</li>
                          <li>Haz clic en la barra de búsqueda de tu navegador</li>
                          <li>Selecciona todo el enlace y cópialo</li>
                          <li>Pega ese valor en el formulario</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Social Media */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border-2 border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Link className="w-5 h-5" />
              Redes Sociales
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                  Instagram
                </label>
                <input
                  type="text"
                  value={formData.instagram}
                  onChange={(e) => handleInputChange('instagram', e.target.value)}
                  placeholder="@tuclub"
                  maxLength={500}
                  className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none bg-gray-50 dark:bg-gray-700"
                />
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                  {formData.instagram.length}/500
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                  </svg>
                  WhatsApp
                </label>
                <input
                  type="text"
                  value={formData.whatsapp}
                  onChange={(e) => handleInputChange('whatsapp', e.target.value)}
                  placeholder="+1234567890"
                  maxLength={500}
                  className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none bg-gray-50 dark:bg-gray-700"
                />
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                  {formData.whatsapp.length}/500
                </div>
              </div>
            </div>
          </div>

          {/* Club Details */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border-2 border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Music className="w-5 h-5" />
              Detalles del Club
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Edad Mínima
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.minimumAge || ''}
                    onChange={(e) => {
                      const value = e.target.value ? parseInt(e.target.value) : null;
                      if (value !== null && value < 0) return; // Prevent negative values
                      handleInputChange('minimumAge', value);
                    }}
                    className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none bg-gray-50 dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Código de Vestimenta
                  </label>
                  <textarea
                    value={formData.dressCode}
                    onChange={(e) => handleInputChange('dressCode', e.target.value)}
                    rows={Math.max(3, Math.ceil(formData.dressCode.length / 50))}
                    maxLength={500}
                    className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none bg-gray-50 dark:bg-gray-700 resize-none"
                  />
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                    {formData.dressCode.length}/500
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipos de Música
                </label>
                
                {/* Display current music genres */}
                <div className="mb-4">
                  {formData.musicType.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                      No hay géneros musicales agregados
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {formData.musicType.map((genre, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-3 py-1 rounded-full text-sm"
                        >
                          <span>{genre}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveMusicGenre(genre)}
                            className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add new music genre */}
                <div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={newMusicGenre}
                      onChange={(e) => setNewMusicGenre(e.target.value)}
                      onKeyPress={handleMusicGenreKeyPress}
                      placeholder="Agregar género musical..."
                      maxLength={50}
                      className="flex-1 px-3 py-2 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none bg-gray-50 dark:bg-gray-700"
                    />
                    <button
                      type="button"
                      onClick={handleAddMusicGenre}
                      disabled={!newMusicGenre.trim() || formData.musicType.includes(newMusicGenre.trim().charAt(0).toUpperCase() + newMusicGenre.trim().slice(1).toLowerCase())}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar
                    </button>
                  </div>
                  {newMusicGenre.trim() && formData.musicType.includes(newMusicGenre.trim().charAt(0).toUpperCase() + newMusicGenre.trim().slice(1).toLowerCase()) && (
                    <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                      Este género ya está agregado
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Información Adicional
                </label>
                <textarea
                  value={formData.extraInfo}
                  onChange={(e) => handleInputChange('extraInfo', e.target.value)}
                  rows={Math.max(3, Math.ceil(formData.extraInfo.length / 50))}
                  maxLength={500}
                  className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none bg-gray-50 dark:bg-gray-700 resize-none"
                />
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                  {formData.extraInfo.length}/500
                </div>
              </div>
            </div>
          </div>

          {/* Operating Hours */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border-2 border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Horarios de Operación
            </h3>
            <div className="space-y-3">
              {daysOfWeek.map((day) => {
                const isSelected = formData.openDays.includes(day);
                const dayHours = formData.openHours.find(hours => hours.day === day);
                
                return (
                  <div key={day} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    {/* Day Pill */}
                    <button
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          handleInputChange('openDays', formData.openDays.filter(d => d !== day));
                        } else {
                          handleInputChange('openDays', [...formData.openDays, day]);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 flex-shrink-0 w-20 text-center ${
                        isSelected
                          ? 'bg-purple-600 text-white shadow-lg'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:text-purple-700 dark:hover:text-purple-300'
                      }`}
                    >
                      {dayTranslations[day]}
                    </button>
                    
                    {/* Hours Selector - Only show if day is selected */}
                    {isSelected && (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="time"
                          value={dayHours?.open || ''}
                          onChange={(e) => {
                            const updatedOpenHours = formData.openHours.map(hours => 
                              hours.day === day 
                                ? { ...hours, open: e.target.value }
                                : hours
                            );
                            handleInputChange('openHours', updatedOpenHours);
                          }}
                          className="px-2 py-1.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none bg-gray-50 dark:bg-gray-700 text-sm flex-1"
                        />
                        <span className="text-gray-500 text-sm">a</span>
                        <input
                          type="time"
                          value={dayHours?.close || ''}
                          onChange={(e) => {
                            const updatedOpenHours = formData.openHours.map(hours => 
                              hours.day === day 
                                ? { ...hours, close: e.target.value }
                                : hours
                            );
                            handleInputChange('openHours', updatedOpenHours);
                          }}
                          className="px-2 py-1.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none bg-gray-50 dark:bg-gray-700 text-sm flex-1"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
      </div>
    </div>
    </UnsavedChangesProvider>
  );
}