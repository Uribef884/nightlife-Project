'use client';

import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import Image from 'next/image';

interface Club {
  id: string;
  name: string;
  city: string;
  profileImageUrl?: string;
}

interface ClubSelectorProps {
  selectedClub: string | null;
  onClubChange: (clubId: string | null) => void;
  refreshTrigger?: number; // Add this to trigger refresh when image is uploaded
}

export function ClubSelector({ selectedClub, onClubChange, refreshTrigger }: ClubSelectorProps) {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClubs = async () => {
      try {
        setLoading(true);
        const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
        const response = await fetch(`${API_BASE}/auth/available-clubs`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Include cookies for authentication
        });

        if (!response.ok) {
          throw new Error('Failed to fetch clubs');
        }

        const data = await response.json();
        setClubs(data.clubs || []);
      } catch (err) {
        console.error('Error fetching clubs:', err);
        setClubs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchClubs();
  }, [refreshTrigger]); // Add refreshTrigger as dependency

  const selectedClubData = clubs.find(club => club.id === selectedClub);

  const handleClubSelect = async (clubId: string) => {
    
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
      const response = await fetch(`${API_BASE}/auth/select-club`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({ clubId }),
      });


      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to select club: ${response.status} - ${errorText}`);
      }

      await response.json();

      // Close dropdown first
      setIsOpen(false);
      
      // Update the parent component with the new club selection
      onClubChange(clubId);
      
      // Reload the page to pick up the new JWT token with updated clubId
      window.location.reload();
    } catch (err) {
      console.error('Error selecting club:', err);
      // Still close the dropdown even if there's an error
      setIsOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        <div className="w-32 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 sm:space-x-3 px-3 sm:px-4 py-2 !bg-white dark:!bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors w-full sm:w-auto text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
      >
        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
          {selectedClub && selectedClubData ? (
            <div className="w-full h-full rounded-lg flex items-center justify-center">
              {selectedClubData.profileImageUrl ? (
                <Image 
                  src={selectedClubData.profileImageUrl} 
                  alt={`${selectedClubData.name} logo`}
                  width={32}
                  height={32}
                  className="object-cover rounded-lg"
                  onError={(e) => {
                    // Hide the image and show SVG fallback
                    e.currentTarget.style.display = 'none';
                    const svg = e.currentTarget.nextElementSibling as HTMLElement;
                    if (svg) svg.style.display = 'block';
                  }}
                />
              ) : null}
              <svg 
                width="100%" 
                height="100%" 
                viewBox="0 0 400 400" 
                xmlns="http://www.w3.org/2000/svg" 
                className="rounded-lg"
                style={{ display: selectedClubData.profileImageUrl ? 'none' : 'block' }}
              >
                <defs>
                  <linearGradient id="main-g" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0" stopColor="#6B3FA0" stopOpacity="0.35"/>
                    <stop offset="1" stopColor="#000000" stopOpacity="0.6"/>
                  </linearGradient>
                </defs>
                <rect width="400" height="400" fill="url(#main-g)"/>
                <g fill="#ffffff" fillOpacity="0.85">
                  <circle cx="200" cy="180" r="60"/>
                  <rect x="120" y="260" width="160" height="24" rx="12"/>
                </g>
              </svg>
            </div>
          ) : (
            <div className="w-full h-full rounded-lg flex items-center justify-center">
              <svg width="100%" height="100%" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" className="rounded-lg">
                <defs>
                  <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0" stopColor="#6B3FA0" stopOpacity="0.35"/>
                    <stop offset="1" stopColor="#000000" stopOpacity="0.6"/>
                  </linearGradient>
                </defs>
                <rect width="400" height="400" fill="url(#g)"/>
                <g fill="#ffffff" fillOpacity="0.85">
                  <circle cx="200" cy="180" r="60"/>
                  <rect x="120" y="260" width="160" height="24" rx="12"/>
                </g>
              </svg>
            </div>
          )}
        </div>
        <div className="text-left flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {selectedClubData?.name || 'Seleccionar Club'}
          </p>
          {selectedClubData && (
            <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
              {selectedClubData.city}
            </p>
          )}
        </div>
        <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-full sm:w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-20">
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Seleccionar Club
              </div>
              
              {clubs.map((club) => (
                <button
                  key={club.id}
                  onClick={() => handleClubSelect(club.id)}
                  className={`
                    w-full flex items-center space-x-3 px-3 py-2 text-left rounded-md transition-colors
                    ${selectedClub === club.id
                      ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
                    }
                  `}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
                    {club.profileImageUrl ? (
                      <Image 
                        src={club.profileImageUrl} 
                        alt={`${club.name} logo`}
                        width={32}
                        height={32}
                        className="object-cover rounded-lg"
                        onError={(e) => {
                          // Hide the image and show SVG fallback
                          e.currentTarget.style.display = 'none';
                          const svg = e.currentTarget.nextElementSibling as HTMLElement;
                          if (svg) svg.style.display = 'block';
                        }}
                      />
                    ) : null}
                    <svg 
                      width="100%" 
                      height="100%" 
                      viewBox="0 0 400 400" 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="rounded-lg"
                      style={{ display: club.profileImageUrl ? 'none' : 'block' }}
                    >
                      <defs>
                        <linearGradient id={`club-g-${club.id}`} x1="0" x2="1" y1="0" y2="1">
                          <stop offset="0" stopColor="#6B3FA0" stopOpacity="0.35"/>
                          <stop offset="1" stopColor="#000000" stopOpacity="0.6"/>
                        </linearGradient>
                      </defs>
                      <rect width="400" height="400" fill={`url(#club-g-${club.id})`}/>
                      <g fill="#ffffff" fillOpacity="0.85">
                        <circle cx="200" cy="180" r="60"/>
                        <rect x="120" y="260" width="160" height="24" rx="12"/>
                      </g>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{club.name}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{club.city}</p>
                  </div>
                </button>
              ))}
              
              {clubs.length === 0 && (
                <div className="px-3 py-4 text-center text-gray-500 dark:text-gray-400">
                  <p className="text-sm">No se encontraron clubes</p>
                  <p className="text-xs mt-1">Contacta soporte para agregar tu club</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}