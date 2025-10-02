'use client';

import { useState, useEffect } from 'react';
import { Plus, Calendar, Clock, Image, Loader2, AlertCircle } from 'lucide-react';
import { CreateEventModal } from './CreateEventModal';

interface EventsManagementProps {
  clubId: string;
}

interface Event {
  id: string;
  name: string;
  description: string;
  availableDate: string;
  openHours: {
    open: string;
    close: string;
  };
  bannerUrl?: string;
  status: 'upcoming' | 'past' | 'active';
  tickets?: Array<{
    id: string;
    name: string;
    price: number;
  }>;
}

export function EventsManagement({ clubId }: EventsManagementProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Load events
  const loadEvents = async () => {
    if (!clubId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
      const response = await fetch(`${API_BASE}/events/club/${clubId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to load events: ${response.status}`);
      }

      const eventsData = await response.json();
      setEvents(eventsData);
    } catch (error) {
      console.error('Error loading events:', error);
      setError('Error al cargar los eventos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [clubId]);

  const handleCreateSuccess = () => {
    loadEvents(); // Reload events after creation
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getEventStatus = (dateString: string) => {
    const eventDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (eventDate < today) return 'past';
    if (eventDate.toDateString() === today.toDateString()) return 'active';
    return 'upcoming';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center space-x-3">
          <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
          <span className="text-gray-600 dark:text-gray-400">Cargando eventos...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Error al cargar eventos
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
        <button
          onClick={loadEvents}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Gestión de Eventos
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Planifica y organiza eventos especiales para tu club
          </p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Crear Evento</span>
        </button>
      </div>

      {/* Events List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {events.map((event) => {
          const status = getEventStatus(event.availableDate);
          const statusLabels = {
            upcoming: 'Próximo',
            active: 'Hoy',
            past: 'Pasado'
          };
          const statusColors = {
            upcoming: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
            active: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
            past: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
          };

          return (
            <div
              key={event.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden"
            >
              {/* Event Banner */}
              <div className="relative h-32 sm:h-48 bg-gradient-to-r from-purple-500 to-pink-500">
                {event.bannerUrl ? (
                  <img
                    src={event.bannerUrl}
                    alt={event.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Image className="w-12 h-12 text-white opacity-50" />
                  </div>
                )}
                <div className="absolute top-2 right-2 sm:top-4 sm:right-4">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[status]}`}>
                    {statusLabels[status]}
                  </span>
                </div>
              </div>

              {/* Event Details */}
              <div className="p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2 truncate">
                  {event.name}
                </h3>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                  {event.description}
                </p>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(event.availableDate)}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    <Clock className="w-4 h-4" />
                    <span>{event.openHours.open} - {event.openHours.close}</span>
                  </div>
                </div>

                {/* Tickets Count */}
                {event.tickets && event.tickets.length > 0 && (
                  <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {event.tickets.length} ticket{event.tickets.length !== 1 ? 's' : ''} disponible{event.tickets.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                )}

                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                  <button className="flex-1 px-3 py-2 text-xs sm:text-sm bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-md hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors">
                    Editar Evento
                  </button>
                  <button className="flex-1 px-3 py-2 text-xs sm:text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    Ver Tickets
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {events.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No hay eventos
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Crea tu primer evento para comenzar.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            Crear Evento
          </button>
        </div>
      )}

      {/* Create Event Modal */}
      <CreateEventModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
        clubId={clubId}
      />
    </div>
  );
}
