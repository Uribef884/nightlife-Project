'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Ticket, Calendar, Loader2, Eye, EyeOff, Zap, ZapOff, Gift, Star, Clock, Trash2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { isPastDateInBogota, formatBogotaDate } from '@/utils/timezone';

// Utility function to format numbers with thousand separators
const formatNumber = (value: number | string): string => {
  if (value === '' || value === null || value === undefined) return '';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '';
  return num.toLocaleString('es-CO');
};
import { CreateTicketModal } from './CreateTicketModal';
import { UpdateTicketModal } from './UpdateTicketModal';
import { CreateEventModal } from '../events/CreateEventModal';
import { UpdateEventModal } from '../events/UpdateEventModal';
import { ShareButton } from '@/components/common/ShareButton';
import type { ShareableEvent, ShareableTicket } from '@/utils/share';

interface TicketsManagementProps {
  clubId: string;
}

type TicketType = 'general' | 'event';

interface Event {
  id: string;
  name: string;
  description?: string;
  availableDate: string;
  bannerUrl?: string;
  openHours?: {
    open: string;
    close: string;
  };
  tickets: Ticket[];
  isActive?: boolean;
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
  originalQuantity?: number;
  category: 'general' | 'event' | 'free' | 'combo';
  isActive: boolean;
  dynamicPricingEnabled: boolean;
  includesMenuItem: boolean;
  includedMenuItems?: unknown[];
  includedItems?: unknown[];
  includes?: unknown[];
  menuItems?: unknown[];
  eventId?: string;
  availableDate?: string;
}

type IncludedItem = {
  menuItemName?: string;
  name?: string;
  title?: string;
  itemName?: string;
  menuItem?: {
    name?: string;
  };
  quantity?: string | number;
  qty?: string | number;
  variantName?: string;
  variant?: {
    name?: string;
  };
};

/* ---------------- helpers ---------------- */
function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Convert `includedMenuItems` (or fallbacks) into "Q× Name (Variant)" lines. */
function getIncludedLines(ticket: Ticket): string[] {
  const raw =
    (Array.isArray(ticket.includedMenuItems) && ticket.includedMenuItems) ||
    (Array.isArray(ticket.includedItems) && ticket.includedItems) ||
    (Array.isArray(ticket.includes) && ticket.includes) ||
    (Array.isArray(ticket.menuItems) && ticket.menuItems) ||
    [];

  if (!Array.isArray(raw) || raw.length === 0) {
    return [];
  }

  const lines: string[] = [];
  for (const it of raw) {
    if (!it || typeof it !== 'object') continue;
    const includedItem = it as any; // Use any since we know the structure from backend
    
    // Use the actual property names from the backend API
    const baseName = includedItem.menuItemName || includedItem.name || includedItem.title || "";
    
    if (!baseName) {
      continue;
    }

    const qty = toNum(includedItem.quantity) ?? 1;
    const variant = includedItem.variantName || null;
    const label = variant ? `${String(baseName)} (${String(variant)})` : String(baseName);
    const line = `${qty}× ${label}`;
    lines.push(line);
  }
  
  return lines;
}

export function TicketsManagement({ clubId }: TicketsManagementProps) {
  const [activeTab, setActiveTab] = useState<TicketType>('event');
  const [events, setEvents] = useState<Event[]>([]);
  const [activeEvents, setActiveEvents] = useState<Event[]>([]);
  const [inactiveEvents, setInactiveEvents] = useState<Event[]>([]);
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [generalTickets, setGeneralTickets] = useState<Ticket[]>([]);
  const [comboTickets, setComboTickets] = useState<Ticket[]>([]);
  const [freeTickets, setFreeTickets] = useState<Ticket[]>([]);
  const [inactiveTickets, setInactiveTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteEventModal, setShowDeleteEventModal] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showUpdateEventModal, setShowUpdateEventModal] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState<string | null>(null);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  const [ticketToUpdate, setTicketToUpdate] = useState<Ticket | null>(null);
  const [eventToUpdate, setEventToUpdate] = useState<Event | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  const tabs = [
    { key: 'event', label: 'Eventos', icon: Calendar },
    { key: 'general', label: 'General', icon: Ticket }
  ] as const;

  // Function to categorize tickets while maintaining original order
  const categorizeTickets = (tickets: Ticket[]) => {
    // Ensure tickets is an array
    if (!Array.isArray(tickets)) {
      console.warn('categorizeTickets received non-array:', tickets);
      return {
        generalTickets: [],
        comboTickets: [],
        freeTickets: [],
        inactiveTickets: []
      };
    }

    const generalTickets: Ticket[] = [];
    const comboTickets: Ticket[] = [];
    const freeTickets: Ticket[] = [];
    const inactiveTickets: Ticket[] = [];

    // Process tickets in their original order
    tickets.forEach(ticket => {
      // Only move to inactive if it's a past date ticket (not just hidden)
      if (!ticket.eventId && 
          ticket.availableDate && 
          isPastDateInBogota(ticket.availableDate)) {
        inactiveTickets.push(ticket);
      }
      // Then check if it's free (price = 0) - regardless of category or menu items
      else if (Number(ticket.price) === 0 && 
               !ticket.eventId && 
               (!ticket.availableDate || !isPastDateInBogota(ticket.availableDate))) {
        freeTickets.push(ticket);
      }
      // Then check if it's a combo (has menu items but not free)
      else if (!ticket.eventId && 
               ticket.includesMenuItem &&
               Number(ticket.price) > 0 &&
               (!ticket.availableDate || !isPastDateInBogota(ticket.availableDate))) {
        comboTickets.push(ticket);
      }
      // Finally, general tickets (no menu items, not free, not event)
      else if (ticket.category === 'general' && 
               !ticket.eventId && 
               !ticket.includesMenuItem &&
               Number(ticket.price) > 0 &&
               (!ticket.availableDate || !isPastDateInBogota(ticket.availableDate))) {
        generalTickets.push(ticket);
      }
    });
    
    return { generalTickets, comboTickets, freeTickets, inactiveTickets };
  };

  // Categorize events as active or inactive based on date
  const categorizeEvents = (events: Event[]) => {
    if (!Array.isArray(events)) {
      return { activeEvents: [], inactiveEvents: [] };
    }
    
    const activeEvents: Event[] = [];
    const inactiveEvents: Event[] = [];

    events.forEach(event => {
      // Check if event date is in the past
      if (event.availableDate && isPastDateInBogota(event.availableDate)) {
        inactiveEvents.push(event);
      } else {
        activeEvents.push(event);
      }
    });

    return { activeEvents, inactiveEvents };
  };

  // Categorize event tickets function
  const categorizeEventTickets = (tickets: Ticket[]) => {
    if (!Array.isArray(tickets)) {
      return { generalTickets: [], comboTickets: [], freeTickets: [], inactiveTickets: [] };
    }
    
    const generalTickets: Ticket[] = [];
    const comboTickets: Ticket[] = [];
    const freeTickets: Ticket[] = [];
    const inactiveTickets: Ticket[] = [];

    tickets.forEach(ticket => {
      // Only move to inactive if it's a past date ticket (not just hidden)
      if (ticket.availableDate && isPastDateInBogota(ticket.availableDate)) {
        inactiveTickets.push(ticket);
      }
      // Then check if it's free (price = 0)
      else if (Number(ticket.price) === 0) {
        freeTickets.push(ticket);
      }
      // Then check if it's a combo (has menu items but not free)
      else if (ticket.includesMenuItem && Number(ticket.price) > 0) {
        comboTickets.push(ticket);
      }
      // Finally, general tickets (no menu items, not free)
      else {
        generalTickets.push(ticket);
      }
    });

    return { generalTickets, comboTickets, freeTickets, inactiveTickets };
  };

  // Component to render categorized event tickets
  const renderCategorizedEventTickets = (tickets: Ticket[]) => {
    const { generalTickets, comboTickets, freeTickets, inactiveTickets } = categorizeEventTickets(tickets);
    
    const renderTicketList = (ticketList: Ticket[], title: string, emptyMessage: string) => {
      if (ticketList.length === 0) return null;
      
      return (
        <div className="space-y-3">
          <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            {title}
            <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
              {ticketList.length}
            </span>
          </h5>
          {ticketList.map((ticket) => (
            <div
              key={ticket.id}
              className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-4 border border-gray-200 dark:border-gray-600 rounded-lg min-w-0"
              data-ticket-id={ticket.id}
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white leading-tight flex-1 min-w-0">
                      {ticket.name}
                    </h4>
                    <ShareButton
                      options={{
                        ticket: {
                          id: ticket.id,
                          name: ticket.name,
                          description: ticket.description || '',
                          price: ticket.price,
                          dynamicPrice: ticket.dynamicPrice,
                          dynamicPricingEnabled: ticket.dynamicPricingEnabled,
                          category: ticket.category,
                          clubId: clubId,
                          clubName: undefined // We don't have club name in this context
                        },
                        clubId: clubId
                      }}
                      variant="button-gray"
                      size="sm"
                      className="flex-shrink-0"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {!ticket.isActive && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                        OCULTO
                      </span>
                    )}
                    {ticket.includesMenuItem && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        COMBO
                      </span>
                    )}
                    <span className={`
                      px-2 py-1 text-xs font-medium rounded-full w-fit
                      ${ticket.price === 0 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                      }
                    `}>
                      {ticket.price === 0 ? 'GRATIS' : `$${formatNumber(ticket.dynamicPrice || ticket.price)}`}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  <span>Max: {ticket.maxPerPerson}</span>
                  <span>Prioridad: {ticket.priority}</span>
                  {ticket.dynamicPricingEnabled && (
                    <span className="text-purple-600 dark:text-purple-400">
                      Dinámico
                    </span>
                  )}
                  {ticket.quantity && ticket.originalQuantity && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Cantidad:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {ticket.originalQuantity - ticket.quantity} / {ticket.originalQuantity}
                        </span>
                        <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 rounded-full transition-all duration-300"
                            style={{ 
                              width: `${Math.min(((ticket.originalQuantity - ticket.quantity) / ticket.originalQuantity) * 100, 100)}%` 
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {ticket.description && (
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {ticket.description}
                  </p>
                )}
                {ticket.includesMenuItem && (() => {
                  const includedLines = getIncludedLines(ticket);
                  return includedLines.length > 0 ? (
                    <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-md min-w-0">
                      <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1">
                        <svg className="w-3 h-3 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Incluye:
                      </div>
                      <ul className="space-y-1 min-w-0">
                        {includedLines.map((line, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-xs min-w-0">
                            <div className="w-1 h-1 bg-green-500 rounded-full flex-shrink-0 mt-2"></div>
                            <span className="text-gray-600 dark:text-gray-400 font-medium break-words min-w-0">
                              {line}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
                      <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                        <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Incluye elementos del menú
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="flex items-center justify-end sm:justify-start space-x-2 flex-shrink-0">
                <button 
                  onClick={() => handleToggleVisibility(ticket.id)}
                  className={`px-3 py-1 text-xs sm:text-sm rounded-md transition-colors ${
                    ticket.isActive 
                      ? 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-700' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  title={ticket.isActive ? 'Ocultar ticket' : 'Mostrar ticket'}
                >
                  {ticket.isActive ? <Eye className="w-3 h-3 sm:w-4 sm:h-4" /> : <EyeOff className="w-3 h-3 sm:w-4 sm:h-4" />}
                </button>
                {ticket.price > 0 && (
                  <button 
                    onClick={() => handleToggleDynamicPricing(ticket.id)}
                    className={`px-3 py-1 text-xs sm:text-sm rounded-md transition-colors ${
                      ticket.dynamicPricingEnabled 
                        ? 'bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-700' 
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                    title={ticket.dynamicPricingEnabled ? 'Desactivar precio dinámico' : 'Activar precio dinámico'}
                  >
                    {ticket.dynamicPricingEnabled ? <Zap className="w-3 h-3 sm:w-4 sm:h-4" /> : <ZapOff className="w-3 h-3 sm:w-4 sm:h-4" />}
                  </button>
                )}
                <button 
                  onClick={() => handleUpdateClick(ticket)}
                  className="px-3 py-1 text-xs sm:text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Editar
                </button>
                <button 
                  onClick={() => handleDeleteClick(ticket.id)}
                  className="px-3 py-1 text-xs sm:text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800 transition-colors" 
                  title="Eliminar"
                >
                  <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      );
    };

    return (
      <div className="space-y-6">
        {renderTicketList(generalTickets, 'General', 'No hay tickets generales')}
        {renderTicketList(comboTickets, 'Combos', 'No hay tickets de combo')}
        {renderTicketList(freeTickets, 'Gratuitos', 'No hay tickets gratuitos')}
        {renderTicketList(inactiveTickets, 'Ocultos', 'No hay tickets ocultos')}
      </div>
    );
  };

  // API service functions
  const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");

  const fetchEvents = async (clubId: string): Promise<Event[]> => {
    const response = await fetch(`${API_BASE}/events/club/${clubId}?includeHidden=true`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for authentication
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.statusText}`);
    }

    return response.json();
  };

  const fetchTickets = async (): Promise<Ticket[]> => {
    const response = await fetch(`${API_BASE}/tickets/my-club`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for authentication
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch tickets: ${response.statusText}`);
    }

    return response.json();
  };

  const toggleTicketVisibility = async (ticketId: string): Promise<void> => {
    const url = `${API_BASE}/tickets/${ticketId}/hide`;
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to toggle ticket visibility: ${response.status} - ${errorText}`);
    }
  };

  const toggleDynamicPricing = async (ticketId: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/tickets/${ticketId}/toggle-dynamic-pricing`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to toggle dynamic pricing: ${response.statusText}`);
    }
  };

  const toggleEventVisibility = async (eventId: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/events/${eventId}/toggle-visibility`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to toggle event visibility: ${response.statusText}`);
    }
  };

  const deleteTicket = async (ticketId: string): Promise<void> => {
    const url = `${API_BASE}/tickets/${ticketId}`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to delete ticket: ${response.status} - ${errorText}`);
    }
  };

  const deleteEvent = async (eventId: string): Promise<void> => {
    const url = `${API_BASE}/events/${eventId}`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to delete event: ${response.status} - ${errorText}`);
    }
  };

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      if (!clubId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const [eventsData, ticketsData] = await Promise.all([
          fetchEvents(clubId),
          fetchTickets()
        ]);
        
        // Debug logging
        
        // Ensure ticketsData is an array before filtering
        const ticketsArray = Array.isArray(ticketsData) ? ticketsData : [];
        
        setEvents(eventsData);
        setAllTickets(ticketsArray);
        
        // Categorize events as active/inactive
        const { activeEvents, inactiveEvents } = categorizeEvents(eventsData);
        setActiveEvents(activeEvents);
        setInactiveEvents(inactiveEvents);
        
        // Categorize tickets while maintaining original order
        const { generalTickets, comboTickets, freeTickets, inactiveTickets } = categorizeTickets(ticketsArray);
        
        setGeneralTickets(generalTickets);
        setComboTickets(comboTickets);
        setFreeTickets(freeTickets);
        setInactiveTickets(inactiveTickets);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
        console.error('Error loading tickets data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [clubId]);

  // Helper function to update a specific ticket in categorized arrays
  const updateTicketInCategorizedArrays = (ticketId: string, updatedTicket: Ticket) => {
    const updateArray = (tickets: Ticket[]) => 
      tickets.map(ticket => ticket.id === ticketId ? updatedTicket : ticket);

    // Update the ticket in all arrays - tickets stay in their original categories
    setGeneralTickets(prev => updateArray(prev));
    setComboTickets(prev => updateArray(prev));
    setFreeTickets(prev => updateArray(prev));
    setInactiveTickets(prev => updateArray(prev));
  };

  // Toggle event expansion (accordion behavior - only one event can be expanded at a time)
  const toggleEventExpansion = (eventId: string) => {
    setExpandedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        // If the event is already expanded, collapse it
        newSet.clear();
      } else {
        // If the event is not expanded, collapse all others and expand this one
        newSet.clear();
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  // Handler functions for toggle actions
  const handleToggleVisibility = async (ticketId: string) => {
    try {
      await toggleTicketVisibility(ticketId);
      
      // Update allTickets
      setAllTickets(prevTickets => {
        const updatedTickets = prevTickets.map(ticket => 
          ticket.id === ticketId 
            ? { ...ticket, isActive: !ticket.isActive }
            : ticket
        );
        
        // Find the updated ticket
        const updatedTicket = updatedTickets.find(t => t.id === ticketId);
        if (updatedTicket) {
          // Update the specific ticket in categorized arrays without re-categorizing
          updateTicketInCategorizedArrays(ticketId, updatedTicket);
        }
        
        return updatedTickets;
      });

      // Also update the events array for event tickets
      setEvents(prevEvents => 
        prevEvents.map(event => ({
          ...event,
          tickets: event.tickets?.map(ticket => 
            ticket.id === ticketId 
              ? { ...ticket, isActive: !ticket.isActive }
              : ticket
          ) || []
        }))
      );
      
    } catch (error) {
      console.error('Error toggling visibility:', error);
      setError(error instanceof Error ? error.message : 'Failed to toggle visibility');
    }
  };

  const handleToggleDynamicPricing = async (ticketId: string) => {
    try {
      await toggleDynamicPricing(ticketId);
      
      // Update allTickets
      setAllTickets(prevTickets => {
        const updatedTickets = prevTickets.map(ticket => 
          ticket.id === ticketId 
            ? { ...ticket, dynamicPricingEnabled: !ticket.dynamicPricingEnabled }
            : ticket
        );
        
        // Find the updated ticket
        const updatedTicket = updatedTickets.find(t => t.id === ticketId);
        if (updatedTicket) {
          // Update the specific ticket in categorized arrays without re-categorizing
          updateTicketInCategorizedArrays(ticketId, updatedTicket);
        }
        
        return updatedTickets;
      });

      // Also update the events array for event tickets
      setEvents(prevEvents => 
        prevEvents.map(event => ({
          ...event,
          tickets: event.tickets?.map(ticket => 
            ticket.id === ticketId 
              ? { ...ticket, dynamicPricingEnabled: !ticket.dynamicPricingEnabled }
              : ticket
          ) || []
        }))
      );
      
    } catch (error) {
      console.error('Error toggling dynamic pricing:', error);
      setError(error instanceof Error ? error.message : 'Failed to toggle dynamic pricing');
    }
  };

  const handleDeleteClick = (ticketId: string) => {
    setTicketToDelete(ticketId);
    setShowDeleteModal(true);
  };

  const handleToggleEventVisibility = async (eventId: string) => {
    try {
      await toggleEventVisibility(eventId);
      
      // Update the events array and cascade to child tickets
      setEvents(prevEvents => {
        const updatedEvents = prevEvents.map(event => 
          event.id === eventId 
            ? { 
                ...event, 
                isActive: !event.isActive,
                tickets: event.tickets?.map(ticket => ({
                  ...ticket,
                  isActive: !event.isActive
                })) || []
              }
            : event
        );
        
        // Update categorized event arrays
        const { activeEvents, inactiveEvents } = categorizeEvents(updatedEvents);
        setActiveEvents(activeEvents);
        setInactiveEvents(inactiveEvents);
        
        return updatedEvents;
      });

      // Also update the allTickets array to reflect the cascaded changes
      setAllTickets(prevTickets => {
        const updatedTickets = prevTickets.map(ticket => 
          ticket.eventId === eventId 
            ? { ...ticket, isActive: !ticket.isActive }
            : ticket
        );
        
        // Update categorized ticket arrays
        const { generalTickets, comboTickets, freeTickets, inactiveTickets } = categorizeTickets(updatedTickets);
        setGeneralTickets(generalTickets);
        setComboTickets(comboTickets);
        setFreeTickets(freeTickets);
        setInactiveTickets(inactiveTickets);
        
        return updatedTickets;
      });
      
    } catch (error) {
      console.error('Error toggling event visibility:', error);
      setError(error instanceof Error ? error.message : 'Failed to toggle event visibility');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!ticketToDelete) return;
    
    try {
      await deleteTicket(ticketToDelete);
      
      // Remove the ticket from local state
      setAllTickets(prevTickets => 
        prevTickets.filter(ticket => ticket.id !== ticketToDelete)
      );
      
      // Update the categorized lists with the new data
      setAllTickets(currentTickets => {
        const { generalTickets, comboTickets, freeTickets, inactiveTickets } = categorizeTickets(currentTickets);
        setGeneralTickets(generalTickets);
        setComboTickets(comboTickets);
        setFreeTickets(freeTickets);
        setInactiveTickets(inactiveTickets);
        return currentTickets;
      });
      
      // Close modal and reset state
      setShowDeleteModal(false);
      setTicketToDelete(null);
    } catch (error) {
      console.error('Error deleting ticket:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete ticket');
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setTicketToDelete(null);
  };

  const handleDeleteEventClick = (eventId: string) => {
    setEventToDelete(eventId);
    setShowDeleteEventModal(true);
  };

  const handleDeleteEventConfirm = async () => {
    if (!eventToDelete) return;
    
    try {
      await deleteEvent(eventToDelete);
      
      // Remove the event from local state
      setEvents(prevEvents => 
        prevEvents.filter(event => event.id !== eventToDelete)
      );
      
      // Update the categorized event lists
      setEvents(currentEvents => {
        const { activeEvents, inactiveEvents } = categorizeEvents(currentEvents);
        setActiveEvents(activeEvents);
        setInactiveEvents(inactiveEvents);
        return currentEvents;
      });
      
      // Close modal and reset state
      setShowDeleteEventModal(false);
      setEventToDelete(null);
    } catch (error) {
      console.error('Error deleting event:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete event');
    }
  };

  const handleDeleteEventCancel = () => {
    setShowDeleteEventModal(false);
    setEventToDelete(null);
  };

  const handleUpdateClick = (ticket: Ticket) => {
    setTicketToUpdate(ticket);
    setShowUpdateModal(true);
  };

  const handleUpdateEventClick = (event: Event) => {
    setEventToUpdate(event);
    setShowUpdateEventModal(true);
  };

  const handleUpdateSuccess = () => {
    setShowUpdateModal(false);
    setTicketToUpdate(null);
    // Refresh data
    const loadData = async () => {
      if (!clubId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const [eventsData, ticketsData] = await Promise.all([
          fetchEvents(clubId),
          fetchTickets()
        ]);
        
        const ticketsArray = Array.isArray(ticketsData) ? ticketsData : [];
        
        setEvents(eventsData);
        setAllTickets(ticketsArray);
        
        // Categorize events as active/inactive
        const { activeEvents, inactiveEvents } = categorizeEvents(eventsData);
        setActiveEvents(activeEvents);
        setInactiveEvents(inactiveEvents);
        
        const { generalTickets, comboTickets, freeTickets, inactiveTickets } = categorizeTickets(ticketsArray);
        
        setGeneralTickets(generalTickets);
        setComboTickets(comboTickets);
        setFreeTickets(freeTickets);
        setInactiveTickets(inactiveTickets);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
        console.error('Error loading tickets data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  };

  const handleUpdateEventSuccess = () => {
    setShowUpdateEventModal(false);
    setEventToUpdate(null);
    // Refresh data
    const loadData = async () => {
      if (!clubId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const [eventsData, ticketsData] = await Promise.all([
          fetchEvents(clubId),
          fetchTickets()
        ]);
        
        const ticketsArray = Array.isArray(ticketsData) ? ticketsData : [];
        
        setEvents(eventsData);
        setAllTickets(ticketsArray);
        
        // Categorize events as active/inactive
        const { activeEvents, inactiveEvents } = categorizeEvents(eventsData);
        setActiveEvents(activeEvents);
        setInactiveEvents(inactiveEvents);
        
        const { generalTickets, comboTickets, freeTickets, inactiveTickets } = categorizeTickets(ticketsArray);
        
        setGeneralTickets(generalTickets);
        setComboTickets(comboTickets);
        setFreeTickets(freeTickets);
        setInactiveTickets(inactiveTickets);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
        console.error('Error loading tickets data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  };

  // Helper component to render ticket sections
  const TicketSection = ({ 
    title, 
    tickets, 
    emptyMessage, 
    icon: Icon,
    isInactive = false
  }: { 
    title: string; 
    tickets: Ticket[]; 
    emptyMessage: string; 
    icon: any;
    isInactive?: boolean;
  }) => {
    if (tickets.length === 0) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
            {tickets.length}
          </span>
        </div>
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-4 border border-gray-200 dark:border-gray-600 rounded-lg min-w-0"
            >
                <div className="flex-1 min-w-0">
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white leading-tight flex-1 min-w-0">
                      {ticket.name}
                    </h4>
                    {!isInactive && (
                      <ShareButton
                        options={{
                          ticket: {
                            id: ticket.id,
                            name: ticket.name,
                            description: ticket.description || '',
                            price: ticket.price,
                            dynamicPrice: ticket.dynamicPrice,
                            dynamicPricingEnabled: ticket.dynamicPricingEnabled,
                            category: ticket.category,
                            clubId: clubId,
                            clubName: undefined // We don't have club name in this context
                          },
                          clubId: clubId
                        }}
                        variant="button-gray"
                        size="sm"
                        className="flex-shrink-0"
                      />
                    )}
                  </div>
                  {ticket.availableDate && (
                    <div>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                        isPastDateInBogota(ticket.availableDate) 
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' 
                          : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                      }`}>
                        <Calendar className="h-4 w-4 mr-2" />
                        {formatBogotaDate(ticket.availableDate, 'dd/MM/yyyy')}
                        {isPastDateInBogota(ticket.availableDate) && ' (Vencido)'}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {!ticket.isActive && !isInactive && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                        OCULTO
                      </span>
                    )}
                    {ticket.includesMenuItem && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        COMBO
                      </span>
                    )}
                    <span className={`
                      px-2 py-1 text-xs font-medium rounded-full w-fit
                      ${ticket.price === 0 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                      }
                    `}>
                      {ticket.price === 0 ? 'GRATIS' : `$${formatNumber(ticket.dynamicPrice || ticket.price)}`}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  <span>Max: {ticket.maxPerPerson}</span>
                  <span>Prioridad: {ticket.priority}</span>
                  {ticket.dynamicPricingEnabled && (
                    <span className="text-purple-600 dark:text-purple-400">
                      Dinámico
                    </span>
                  )}
                  {ticket.quantity && ticket.originalQuantity && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Cantidad:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {ticket.originalQuantity - ticket.quantity} / {ticket.originalQuantity}
                        </span>
                        <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 rounded-full transition-all duration-300"
                            style={{ 
                              width: `${Math.min(((ticket.originalQuantity - ticket.quantity) / ticket.originalQuantity) * 100, 100)}%` 
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {ticket.description && (
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {ticket.description}
                  </p>
                )}
                {ticket.includesMenuItem && (() => {
                  const includedLines = getIncludedLines(ticket);
                  return includedLines.length > 0 ? (
                    <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-md min-w-0">
                      <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1">
                        <svg className="w-3 h-3 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Incluye:
                      </div>
                      <ul className="space-y-1 min-w-0">
                        {includedLines.map((line, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-xs min-w-0">
                            <div className="w-1 h-1 bg-green-500 rounded-full flex-shrink-0 mt-2"></div>
                            <span className="text-gray-600 dark:text-gray-400 font-medium break-words min-w-0">
                              {line}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
                      <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                        <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Incluye elementos del menú
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="flex items-center justify-end sm:justify-start space-x-2 flex-shrink-0">
                {!isInactive && (
                  <>
                    <button 
                      onClick={() => handleToggleVisibility(ticket.id)}
                      className={`px-3 py-1 text-xs sm:text-sm rounded-md transition-colors ${
                        ticket.isActive 
                          ? 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-700' 
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                      title={ticket.isActive ? 'Ocultar ticket' : 'Mostrar ticket'}
                    >
                      {ticket.isActive ? <Eye className="w-3 h-3 sm:w-4 sm:h-4" /> : <EyeOff className="w-3 h-3 sm:w-4 sm:h-4" />}
                    </button>
                    {ticket.price > 0 && (
                      <button 
                        onClick={() => handleToggleDynamicPricing(ticket.id)}
                        className={`px-3 py-1 text-xs sm:text-sm rounded-md transition-colors ${
                          ticket.dynamicPricingEnabled 
                            ? 'bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-700' 
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                        title={ticket.dynamicPricingEnabled ? 'Desactivar precio dinámico' : 'Activar precio dinámico'}
                      >
                        {ticket.dynamicPricingEnabled ? <Zap className="w-3 h-3 sm:w-4 sm:h-4" /> : <ZapOff className="w-3 h-3 sm:w-4 sm:h-4" />}
                      </button>
                    )}
                    <button 
                      onClick={() => handleUpdateClick(ticket)}
                      className="px-3 py-1 text-xs sm:text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      Editar
                    </button>
                  </>
                )}
                <button 
                  onClick={() => handleDeleteClick(ticket.id)}
                  className="px-3 py-1 text-xs sm:text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800 transition-colors" 
                  title="Eliminar"
                >
                  <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6 w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Ticket</span>
          </button>
          <button 
            onClick={() => setShowCreateEventModal(true)}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <Calendar className="w-4 h-4" />
            <span>Crear Evento</span>
          </button>
        </div>
      </div>

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

      {/* Loading State */}
      {loading && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-6">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              <span className="ml-2 text-gray-600 dark:text-gray-400">Cargando datos...</span>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-6">
            <div className="text-center py-12">
              <div className="text-red-500 mb-4">Error al cargar los datos</div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
              <button 
                onClick={() => window.location.reload()} 
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6">
          <div className="space-y-4">
              {activeTab === 'event' ? (
                // Events Tab - Show events with their tickets
                (activeEvents.length > 0 || inactiveEvents.length > 0) ? (
                  <div className="space-y-6">
                    {/* Information Banner - Only show when there are active events that are hidden */}
                    {activeEvents.some(event => !event.isActive) && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <EyeOff className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                          <span className="text-sm text-yellow-800 dark:text-yellow-200">
                            Algunos eventos están ocultos para el público pero visibles para ti como propietario del club.
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* Active Events Section */}
                    {activeEvents.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Eventos Activos</h3>
                          <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                            {activeEvents.length}
                          </span>
                        </div>
                        {activeEvents.map((event) => {
                    const isExpanded = expandedEvents.has(event.id);
                    
                    return (
                      <div key={event.id} className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden" data-event-id={event.id}>
                        {/* Event Banner */}
                        {event.bannerUrl && (
                          <div className="relative h-48 w-full overflow-hidden">
                            <img
                              src={event.bannerUrl}
                              alt={event.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                          </div>
                        )}
                        
                        {/* Event Header - Always Visible */}
                        <div className="p-4">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                            <div className="flex-1">
                              <div className="mb-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                                      {event.name}
                                    </h3>
                                    {!event.isActive && (
                                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 flex-shrink-0">
                                        OCULTO
                                      </span>
                                    )}
                                  </div>
                                  <ShareButton
                                    options={{
                                      event: {
                                        id: event.id,
                                        name: event.name,
                                        description: event.description || '',
                                        availableDate: event.availableDate,
                                        bannerUrl: event.bannerUrl,
                                        clubId: clubId,
                                        clubName: undefined // We don't have club name in this context
                                      },
                                      clubId: clubId
                                    }}
                                    variant="button-gray"
                                    size="sm"
                                    className="flex-shrink-0"
                                  />
                                </div>
                              </div>
                            {event.availableDate && (
                              <div className="mb-2">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                                  isPastDateInBogota(event.availableDate) 
                                    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' 
                                    : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                                }`}>
                                  <Calendar className="h-4 w-4 mr-2" />
                                  {formatBogotaDate(event.availableDate, 'dd/MM/yyyy')}
                                  {isPastDateInBogota(event.availableDate) && ' (Vencido)'}
                                </span>
                              </div>
                            )}
                            {event.description && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                {event.description}
                              </p>
                            )}
                            {event.openHours && (
                              <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 mb-2">
                                <Clock className="h-4 w-4" />
                                <span>{event.openHours.open} - {event.openHours.close}</span>
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                              <span>Tickets: {event.tickets?.length || 0}</span>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <button 
                              onClick={() => toggleEventExpansion(event.id)}
                              className="px-3 py-1 text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-md hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors flex items-center gap-1"
                            >
                              <div className={`transition-transform duration-300 ease-in-out ${
                                isExpanded ? 'rotate-180' : 'rotate-0'
                              }`}>
                                <ChevronDown className="w-3 h-3" />
                              </div>
                              {isExpanded ? 'Ocultar Reservas' : 'Ver Reservas'}
                            </button>
                            <button 
                              onClick={() => handleToggleEventVisibility(event.id)}
                              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                                event.isActive 
                                  ? 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-700' 
                                  : 'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500'
                              }`}
                              title={event.isActive ? 'Ocultar evento' : 'Mostrar evento'}
                            >
                              {event.isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                            </button>
                            <button 
                              onClick={() => handleUpdateEventClick(event)}
                              className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            >
                              Editar
                            </button>
                            <button 
                              onClick={() => handleDeleteEventClick(event.id)}
                              className="px-3 py-1 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800 transition-colors" 
                              title="Eliminar"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          </div>
                        </div>
                        
                        {/* Collapsible Content with Animation */}
                        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
                          isExpanded ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
                        }`}>
                          <div className="border-t border-gray-200 dark:border-gray-600 pt-4 px-4 pb-4">
                            {/* Event Tickets - Categorized */}
                            {event.tickets && event.tickets.length > 0 ? (
                              <div className="space-y-4">
                                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Tickets del Evento:</h4>
                                {renderCategorizedEventTickets(event.tickets)}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                                No hay tickets para este evento
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                      </div>
                    )}
                    
                    {/* Inactive Events Section */}
                    {inactiveEvents.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Eventos Pasados</h3>
                          <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                            {inactiveEvents.length}
                          </span>
                        </div>
                        {inactiveEvents.map((event) => {
                          const isExpanded = expandedEvents.has(event.id);
                          
                          return (
                            <div key={event.id} className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden opacity-75">
                              {/* Event Banner */}
                              {event.bannerUrl && (
                                <div className="relative h-48 w-full overflow-hidden">
                                  <img
                                    src={event.bannerUrl}
                                    alt={event.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                    }}
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                                </div>
                              )}
                              
                              {/* Event Header - Always Visible */}
                              <div className="p-4">
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                                  <div className="flex-1">
                                    <div className="mb-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                                            {event.name}
                                          </h3>
                                          {!event.isActive && (
                                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 flex-shrink-0">
                                              OCULTO
                                            </span>
                                          )}
                                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 flex-shrink-0">
                                            VENCIDO
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    {event.availableDate && (
                                      <div className="mb-2">
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                          <Calendar className="h-4 w-4 mr-2" />
                                          {formatBogotaDate(event.availableDate, 'dd/MM/yyyy')} (Vencido)
                                        </span>
                                      </div>
                                    )}
                                    {event.description && (
                                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                        {event.description}
                                      </p>
                                    )}
                                    {event.openHours && (
                                      <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 mb-2">
                                        <Clock className="h-4 w-4" />
                                        <span>{event.openHours.open} - {event.openHours.close}</span>
                                      </div>
                                    )}
                                    <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                                      <span>Tickets: {event.tickets?.length || 0}</span>
                                    </div>
                                  </div>
                                  <div className="flex space-x-2">
                                    <button 
                                      onClick={() => toggleEventExpansion(event.id)}
                                      className="px-3 py-1 text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-md hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors flex items-center gap-1"
                                    >
                                      <div className={`transition-transform duration-300 ease-in-out ${
                                        isExpanded ? 'rotate-180' : 'rotate-0'
                                      }`}>
                                        <ChevronDown className="w-3 h-3" />
                                      </div>
                                      {isExpanded ? 'Ocultar Reservas' : 'Ver Reservas'}
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteEventClick(event.id)}
                                      className="px-3 py-1 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800 transition-colors" 
                                      title="Eliminar"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Collapsible Content with Animation */}
                              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
                                isExpanded ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
                              }`}>
                                <div className="border-t border-gray-200 dark:border-gray-600 pt-4 px-4 pb-4">
                                  {/* Event Tickets - Categorized */}
                                  {event.tickets && event.tickets.length > 0 ? (
                                    <div className="space-y-4">
                                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Tickets del Evento:</h4>
                                      {renderCategorizedEventTickets(event.tickets)}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                                      No hay tickets para este evento
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No hay eventos
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Crea tu primer evento para comenzar.
                    </p>
                  </div>
                )
              ) : (
                // General Tab - Show separated ticket sections
                (comboTickets.length > 0 || generalTickets.length > 0 || freeTickets.length > 0 || inactiveTickets.length > 0) ? (
                  <div className="space-y-8">
                    {/* Information Banner - Show when there are hidden tickets (but not inactive/past date tickets) */}
                    {allTickets.some(ticket => !ticket.isActive && (!ticket.availableDate || !isPastDateInBogota(ticket.availableDate))) && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <EyeOff className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                          <span className="text-sm text-yellow-800 dark:text-yellow-200">
                            Algunos tickets están ocultos para el público pero visibles para ti como propietario del club.
                          </span>
                        </div>
                      </div>
                    )}
                    <TicketSection 
                      title="Combos" 
                      tickets={comboTickets} 
                      emptyMessage="No hay combos"
                      icon={Gift}
                    />
                    <TicketSection 
                      title="General" 
                      tickets={generalTickets} 
                      emptyMessage="No hay tickets generales"
                      icon={Ticket}
                    />
                    <TicketSection 
                      title="Gratuitos" 
                      tickets={freeTickets} 
                      emptyMessage="No hay tickets gratuitos"
                      icon={Star}
                    />
                    <TicketSection 
                      title="Inactivos" 
                      tickets={inactiveTickets} 
                      emptyMessage="No hay tickets inactivos"
                      icon={Clock}
                      isInactive={true}
                    />
                  </div>
                ) : (
              <div className="text-center py-12">
                <Ticket className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No hay tickets
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                      Crea tu primer ticket para comenzar.
                </p>
              </div>
                )
            )}
          </div>
        </div>
      </div>
      )}

      {/* Create Ticket Modal */}
      <CreateTicketModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          // Refresh data
          const loadData = async () => {
            if (!clubId) return;
            
            setLoading(true);
            setError(null);
            
            try {
              const [eventsData, ticketsData] = await Promise.all([
                fetchEvents(clubId),
                fetchTickets()
              ]);
              
              const ticketsArray = Array.isArray(ticketsData) ? ticketsData : [];
              
              setEvents(eventsData);
              setAllTickets(ticketsArray);
              
              const { generalTickets, comboTickets, freeTickets, inactiveTickets } = categorizeTickets(ticketsArray);
              
              setGeneralTickets(generalTickets);
              setComboTickets(comboTickets);
              setFreeTickets(freeTickets);
              setInactiveTickets(inactiveTickets);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to load data');
              console.error('Error loading tickets data:', err);
            } finally {
              setLoading(false);
            }
          };
          loadData();
        }}
        clubId={clubId}
        events={events}
      />

      {/* Update Ticket Modal */}
      <UpdateTicketModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        onSuccess={handleUpdateSuccess}
        ticket={ticketToUpdate}
        clubId={clubId}
        events={events}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleDeleteCancel} />
          
          {/* Modal */}
          <div className="relative bg-slate-800 rounded-lg shadow-xl border border-slate-700 max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <Trash2 className="h-6 w-6 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">
                    Eliminar Ticket
                  </h3>
                </div>
              </div>
              <button
                onClick={handleDeleteCancel}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-slate-300">
                ¿Estás seguro de que quieres eliminar este ticket? Esta acción no se puede deshacer.
              </p>
            </div>

            {/* Actions */}
            <div className="flex space-x-3 p-6 border-t border-slate-700">
              <button
                onClick={handleDeleteCancel}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Event Confirmation Modal */}
      {showDeleteEventModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleDeleteEventCancel} />
          
          {/* Modal */}
          <div className="relative bg-slate-800 rounded-lg shadow-xl border border-slate-700 max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <Trash2 className="h-6 w-6 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">
                    Eliminar Evento
                  </h3>
                </div>
              </div>
              <button
                onClick={handleDeleteEventCancel}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-slate-300">
                ¿Estás seguro de que quieres eliminar este evento? Esta acción no se puede deshacer y también eliminará todos los tickets asociados.
              </p>
            </div>

            {/* Actions */}
            <div className="flex space-x-3 p-6 border-t border-slate-700">
              <button
                onClick={handleDeleteEventCancel}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteEventConfirm}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Event Modal */}
      <CreateEventModal
        isOpen={showCreateEventModal}
        onClose={() => setShowCreateEventModal(false)}
        onSuccess={() => {
          setShowCreateEventModal(false);
          // Reload all data after event creation
          const loadData = async () => {
            if (!clubId) return;
            setLoading(true);
            setError(null);
            
            try {
              const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
              
              // Load events
              const eventsResponse = await fetch(`${API_BASE}/events/club/${clubId}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
              });

              if (eventsResponse.ok) {
                const eventsData = await eventsResponse.json();
                setEvents(eventsData);
                
                // Categorize events as active/inactive
                const { activeEvents, inactiveEvents } = categorizeEvents(eventsData);
                setActiveEvents(activeEvents);
                setInactiveEvents(inactiveEvents);
              }

              // Load all tickets
              const ticketsResponse = await fetch(`${API_BASE}/tickets/club/${clubId}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
              });

              if (ticketsResponse.ok) {
                const ticketsData = await ticketsResponse.json();
                const ticketsArray = Array.isArray(ticketsData) ? ticketsData : [];
                setAllTickets(ticketsArray);
                
                const { generalTickets, comboTickets, freeTickets, inactiveTickets } = categorizeTickets(ticketsArray);
                setGeneralTickets(generalTickets);
                setComboTickets(comboTickets);
                setFreeTickets(freeTickets);
                setInactiveTickets(inactiveTickets);
              }
            } catch (error) {
              console.error('Error loading data:', error);
            } finally {
              setLoading(false);
            }
          };
          
          loadData();
        }}
        clubId={clubId}
      />

      {/* Update Event Modal */}
      <UpdateEventModal
        isOpen={showUpdateEventModal}
        onClose={() => setShowUpdateEventModal(false)}
        onSuccess={handleUpdateEventSuccess}
        event={eventToUpdate}
      />
    </div>
  );
}
