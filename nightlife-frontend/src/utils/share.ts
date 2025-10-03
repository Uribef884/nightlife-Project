// nightlife-frontend/src/utils/share.ts

import { formatBogotaDateSpanish } from './timezone';

export interface ShareableEvent {
  id: string;
  name: string;
  description?: string;
  availableDate: string;
  bannerUrl?: string;
  clubId: string;
  clubName?: string;
}

export interface ShareableTicket {
  id: string;
  name: string;
  description?: string;
  price: number;
  dynamicPrice?: number;
  dynamicPricingEnabled?: boolean;
  category: string;
  clubId: string;
  clubName?: string;
  eventId?: string;
  eventName?: string;
  eventDate?: string;
}

export interface ShareOptions {
  event?: ShareableEvent;
  ticket?: ShareableTicket;
  clubId: string;
  clubName?: string;
  selectedDate?: string;
}

/**
 * Generate a shareable URL for events or tickets
 */
export function generateShareUrl(options: ShareOptions): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const clubUrl = `${baseUrl}/clubs/${options.clubId}`;
  
  if (options.event) {
    // For events, link to the club page with the event date selected
    const eventDate = options.event.availableDate.split('T')[0]; // Get YYYY-MM-DD part
    const url = `${clubUrl}?date=${eventDate}&highlight=event:${options.event.id}#reservas`;
    return url;
  }
  
  if (options.ticket) {
    // For tickets, link to the club page with the ticket's date
    
    if (options.ticket.eventDate) {
      // Event tickets: use the event date
      const eventDate = options.ticket.eventDate.split('T')[0];
      const url = `${clubUrl}?date=${eventDate}&highlight=ticket:${options.ticket.id}#reservas`;
      return url;
    } else if (options.selectedDate) {
      // General tickets with a selected date: use the selected date
      const generalDate = options.selectedDate.split('T')[0];
      const url = `${clubUrl}?date=${generalDate}&highlight=ticket:${options.ticket.id}#reservas`;
      return url;
    } else {
      // General tickets without a specific date: use today's date
      const today = new Date().toISOString().split('T')[0];
      const url = `${clubUrl}?date=${today}&highlight=ticket:${options.ticket.id}#reservas`;
      return url;
    }
  }
  
  // Fallback to club page
  return clubUrl;
}

/**
 * Generate share text for social media
 */
export function generateShareText(options: ShareOptions): string {
  if (options.event) {
    const eventDate = formatBogotaDateSpanish(options.event.availableDate, 'cccc, dd \'de\' MMMM \'de\' yyyy');
    
    return `🎉 ¡No te pierdas "${options.event.name}" en ${options.clubName || 'este club'}!\n📅 ${eventDate}\n\nReserva tu lugar aquí 👇`;
  }
  
  if (options.ticket) {
    const price = options.ticket.dynamicPricingEnabled && options.ticket.dynamicPrice 
      ? options.ticket.dynamicPrice 
      : options.ticket.price;
    
    const priceText = price === 0 ? 'GRATIS' : `$${price.toLocaleString('es-CO')}`;
    
    if (options.ticket.eventName && options.ticket.eventDate) {
      const eventDate = formatBogotaDateSpanish(options.ticket.eventDate, 'cccc, dd \'de\' MMMM \'de\' yyyy');
      
      return `🔥 *${options.ticket.name}*\n*${options.ticket.eventName} - ${eventDate}*\n*${priceText}*\n${options.ticket.description || ''}\n\nReserva tu cupo aquí 👇`;
    }
    
    return `🔥 *${options.ticket.name}*\n*${priceText}*\n${options.ticket.description || ''}\n\nReserva tu cupo aquí 👇`;
  }
  
  return `¡Descubre ${options.clubName || 'este club'} y reserva tu lugar! 👇`;
}

/**
 * Share to WhatsApp
 */
export function shareToWhatsApp(options: ShareOptions): void {
  const url = generateShareUrl(options);
  const text = generateShareText(options);
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${text}\n\n${url}`)}`;
  window.open(whatsappUrl, '_blank');
}

/**
 * Share via SMS/iMessage
 */
export function shareToSMS(options: ShareOptions): void {
  const url = generateShareUrl(options);
  const text = generateShareText(options);
  const smsUrl = `sms:?body=${encodeURIComponent(`${text}\n\n${url}`)}`;
  window.location.href = smsUrl;
}


/**
 * Copy to clipboard
 */
export async function copyToClipboard(options: ShareOptions): Promise<boolean> {
  try {
    const url = generateShareUrl(options);
    const text = generateShareText(options);
    const shareText = `${text}\n\n${url}`;
    
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(shareText);
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareText;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      textArea.remove();
    }
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Copy just the URL to clipboard
 */
export async function copyUrlToClipboard(options: ShareOptions): Promise<boolean> {
  try {
    const url = generateShareUrl(options);
    
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url);
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      textArea.remove();
    }
    return true;
  } catch (error) {
    console.error('Failed to copy URL to clipboard:', error);
    return false;
  }
}

/**
 * Native share API (mobile devices)
 */
export async function nativeShare(options: ShareOptions): Promise<boolean> {
  if (!navigator.share) {
    return false;
  }
  
  try {
    const url = generateShareUrl(options);
    const text = generateShareText(options);
    
    await navigator.share({
      title: options.event?.name || options.ticket?.name || `${options.clubName} - Nightlife`,
      text,
      url
    });
    return true;
  } catch (error) {
    console.error('Failed to share natively:', error);
    return false;
  }
}
