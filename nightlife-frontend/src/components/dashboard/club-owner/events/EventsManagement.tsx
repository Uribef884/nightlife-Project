'use client';

import { useState } from 'react';
import { Plus, Calendar, Clock, Image } from 'lucide-react';

interface EventsManagementProps {
  clubId: string;
}

export function EventsManagement({ clubId: _clubId }: EventsManagementProps) {
  const [events] = useState([
    {
      id: '1',
      name: 'New Year Celebration',
      description: 'Ring in the new year with amazing music and drinks',
      availableDate: '2024-12-31',
      openHours: {
        open: '22:00',
        close: '06:00'
      },
      bannerUrl: '/api/placeholder/800/400',
      status: 'upcoming'
    },
    {
      id: '2',
      name: 'Valentine\'s Day Special',
      description: 'Romantic evening with couples special',
      availableDate: '2024-02-14',
      openHours: {
        open: '20:00',
        close: '02:00'
      },
      bannerUrl: '/api/placeholder/800/400',
      status: 'upcoming'
    }
  ]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Events Management
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Plan and organize special events for your club
          </p>
        </div>
        <button className="flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors w-full sm:w-auto">
          <Plus className="w-4 h-4" />
          <span>Create Event</span>
        </button>
      </div>

      {/* Events List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {events.map((event) => (
          <div
            key={event.id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden"
          >
            {/* Event Banner */}
            <div className="relative h-32 sm:h-48 bg-gradient-to-r from-purple-500 to-pink-500">
              <div className="absolute inset-0 flex items-center justify-center">
                <Image className="w-12 h-12 text-white opacity-50" />
              </div>
              <div className="absolute top-2 right-2 sm:top-4 sm:right-4">
                <span className={`
                  px-2 py-1 text-xs font-medium rounded-full
                  ${event.status === 'upcoming' 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                  }
                `}>
                  {event.status}
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
                  <span>{new Date(event.availableDate).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span>{event.openHours.open} - {event.openHours.close}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <button className="flex-1 px-3 py-2 text-xs sm:text-sm bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-md hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors">
                  Edit Event
                </button>
                <button className="flex-1 px-3 py-2 text-xs sm:text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                  View Tickets
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {events.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No events found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Create your first event to get started.
          </p>
        </div>
      )}
    </div>
  );
}
