// nightlife-frontend/src/utils/highlight.ts

export interface HighlightInfo {
  type: 'event' | 'ticket';
  id: string;
}

/**
 * Parse highlight parameter from URL
 * Format: highlight=event:123 or highlight=ticket:456
 */
export function parseHighlightFromURL(): HighlightInfo | null {
  if (typeof window === 'undefined') return null;
  
  const url = new URL(window.location.href);
  const highlightParam = url.searchParams.get('highlight');
  
  if (!highlightParam) return null;
  
  const [type, id] = highlightParam.split(':');
  
  if ((type === 'event' || type === 'ticket') && id) {
    return { type, id };
  }
  
  return null;
}

/**
 * Add highlight class to an element
 */
export function addHighlightClass(element: HTMLElement): void {
  element.classList.add('highlight-item');
  
  // Remove highlight after animation
  setTimeout(() => {
    element.classList.remove('highlight-item');
  }, 3000);
}

/**
 * Scroll to and highlight an element
 */
export function scrollToAndHighlight(element: HTMLElement, offset = 100): void {
  // Scroll to element
  const rect = element.getBoundingClientRect();
  const scrollTop = window.pageYOffset + rect.top - offset;
  
  window.scrollTo({
    top: scrollTop,
    behavior: 'smooth'
  });
  
  // Add highlight after a short delay to ensure element is visible
  setTimeout(() => {
    addHighlightClass(element);
  }, 500);
}

/**
 * Find and highlight an event by ID
 */
export function highlightEvent(eventId: string): boolean {
  const eventElement = document.querySelector(`[data-event-id="${eventId}"]`) as HTMLElement;
  
  if (eventElement) {
    scrollToAndHighlight(eventElement);
    return true;
  }
  
  return false;
}

/**
 * Find and highlight a ticket by ID
 */
export function highlightTicket(ticketId: string): boolean {
  const ticketElement = document.querySelector(`[data-ticket-id="${ticketId}"]`) as HTMLElement;
  
  if (ticketElement) {
    scrollToAndHighlight(ticketElement);
    return true;
  }
  
  return false;
}

/**
 * Highlight item based on highlight info
 */
export function highlightItem(highlightInfo: HighlightInfo): boolean {
  if (highlightInfo.type === 'event') {
    return highlightEvent(highlightInfo.id);
  } else if (highlightInfo.type === 'ticket') {
    return highlightTicket(highlightInfo.id);
  }
  
  return false;
}
