import { Request, Response } from "express";
import { AppDataSource } from "../config/data-source";
import { User } from "../entities/User";
import { Club } from "../entities/Club";
import { MenuPurchaseTransaction } from "../entities/MenuPurchaseTransaction";
import { TicketPurchase } from "../entities/TicketPurchase";
import { decryptQR, QRPayload } from "./decryptQR";

export async function validateClubAccess(
  user: { id: string; role: string; clubId?: string },
  clubId: string
): Promise<boolean> {
  // If user is waiter/bouncer, check if they belong to the club
  if (user.role === "waiter" || user.role === "bouncer") {
    return user.clubId === clubId;
  }

  // If user is clubowner, check if they own the club
  if (user.role === "clubowner") {
    const clubRepository = AppDataSource.getRepository(Club);
    const club = await clubRepository.findOne({
      where: { id: clubId, ownerId: user.id }
    });
    return !!club;
  }

  return false;
}

export function checkDateIsToday(createdAt: Date): boolean {
  const today = new Date();
  const createdDate = new Date(createdAt);
  
  return (
    createdDate.getFullYear() === today.getFullYear() &&
    createdDate.getMonth() === today.getMonth() &&
    createdDate.getDate() === today.getDate()
  );
}

export function checkTicketDateIsValid(ticketDate: Date): boolean {
  // Get current time in Colombia timezone (UTC-5)
  const nowUTC = new Date();
  const colombiaOffset = -5 * 60; // Colombia is UTC-5
  const nowColombia = new Date(nowUTC.getTime() + (colombiaOffset * 60 * 1000));
  
  // Handle date properly to avoid timezone conversion issues
  const eventDateValue = ticketDate as any;
  let year: number, month: number, day: number;
  
  if (typeof eventDateValue === 'string') {
    // Parse string date (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
    const dateStr = eventDateValue.includes('T') ? eventDateValue.split('T')[0] : eventDateValue;
    [year, month, day] = dateStr.split('-').map(Number);
  } else if (eventDateValue instanceof Date) {
    // Extract components from Date object
    year = eventDateValue.getFullYear();
    month = eventDateValue.getMonth() + 1; // getMonth() returns 0-11
    day = eventDateValue.getDate();
  } else {
    // Fallback
    const dateStr = String(eventDateValue).split('T')[0];
    [year, month, day] = dateStr.split('-').map(Number);
  }
  
  // Create event start and end times in Colombia timezone
  // Event is valid from start of event day until 1 AM next day
  const eventStartColombia = new Date(year, month - 1, day, 0, 0, 0);
  const eventEndColombia = new Date(year, month - 1, day + 1, 1, 0, 0);
  
  // Current Colombia time should be between event start and event end (1 AM next day)
  return nowColombia >= eventStartColombia && nowColombia <= eventEndColombia;
}

// New function to check if ticket date is in the future (for preview purposes)
export function isTicketDateInFuture(ticketDate: Date): boolean {
  // Get current time in Colombia timezone (UTC-5)
  const nowUTC = new Date();
  const colombiaOffset = -5 * 60; // Colombia is UTC-5
  const nowColombia = new Date(nowUTC.getTime() + (colombiaOffset * 60 * 1000));
  
  // Handle date properly to avoid timezone conversion issues
  const eventDateValue = ticketDate as any;
  let year: number, month: number, day: number;
  
  if (typeof eventDateValue === 'string') {
    // Parse string date (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
    const dateStr = eventDateValue.includes('T') ? eventDateValue.split('T')[0] : eventDateValue;
    [year, month, day] = dateStr.split('-').map(Number);
  } else if (eventDateValue instanceof Date) {
    // Extract components from Date object
    year = eventDateValue.getFullYear();
    month = eventDateValue.getMonth() + 1; // getMonth() returns 0-11
    day = eventDateValue.getDate();
  } else {
    // Fallback
    const dateStr = String(eventDateValue).split('T')[0];
    [year, month, day] = dateStr.split('-').map(Number);
  }
  
  // Create event start time in Colombia timezone
  const eventStartColombia = new Date(year, month - 1, day, 0, 0, 0);
  
  // Check if current Colombia time is before event start
  return nowColombia < eventStartColombia;
}

export function validateQRType(type: string, expected: "menu" | "ticket" | "menu_from_ticket"): boolean {
  return type === expected;
}

// 🎯 PREVIEW FUNCTION: No restrictions - can be used anytime, any day by bouncers/waiters
export async function previewMenuTransaction(
  qrCode: string,
  user: { id: string; role: string; clubId?: string }
): Promise<{
  isValid: boolean;
  transaction?: MenuPurchaseTransaction;
  error?: string;
}> {
  try {
    const payload = decryptQR(qrCode);

    if (!validateQRType(payload.type, "menu")) {
      return { isValid: false, error: "Invalid QR type for menu validation" };
    }

    if (!payload.id) {
      return { isValid: false, error: "Missing transaction ID in QR code" };
    }

    const transactionRepository = AppDataSource.getRepository(MenuPurchaseTransaction);
    const transaction = await transactionRepository.findOne({
      where: { id: payload.id },
      relations: ["purchases", "purchases.menuItem", "purchases.variant"]
    });

    if (!transaction) {
      return { isValid: false, error: "Transaction not found" };
    }

    const hasAccess = await validateClubAccess(user, transaction.clubId);
    if (!hasAccess) {
      return { isValid: false, error: "Access denied to this club" };
    }

    // Preview has NO time/date restrictions - bouncers/waiters can preview anytime
    return { isValid: true, transaction };
  } catch (error) {
    return { isValid: false, error: "Invalid QR code" };
  }
}

export async function validateMenuTransaction(
  qrCode: string,
  user: { id: string; role: string; clubId?: string }
): Promise<{
  isValid: boolean;
  transaction?: MenuPurchaseTransaction;
  error?: string;
}> {
  try {
    const payload = decryptQR(qrCode);

    if (!validateQRType(payload.type, "menu")) {
      return { isValid: false, error: "Invalid QR type for menu validation" };
    }

    if (!payload.id) {
      return { isValid: false, error: "Missing transaction ID in QR code" };
    }

    const transactionRepository = AppDataSource.getRepository(MenuPurchaseTransaction);
    const transaction = await transactionRepository.findOne({
      where: { id: payload.id },
      relations: ["purchases", "purchases.menuItem", "purchases.variant"]
    });

    if (!transaction) {
      return { isValid: false, error: "Transaction not found" };
    }

    const hasAccess = await validateClubAccess(user, transaction.clubId);
    if (!hasAccess) {
      return { isValid: false, error: "Access denied to this club" };
    }

    // 🎯 SIMPLE RULE: Menu items can only be confirmed on open days, UNLESS there's an event
    const clubRepository = AppDataSource.getRepository(Club);
    const club = await clubRepository.findOne({
      where: { id: transaction.clubId }
    });

    if (!club) {
      return { isValid: false, error: "Club not found" };
    }

    const today = new Date();
    const todayDayName = today.toLocaleString("en-US", { weekday: "long" });
    const todayStr = today.toISOString().split('T')[0];

    // Check if there's an event happening today
    const ticketRepo = AppDataSource.getRepository('Ticket');
    const eventToday = await ticketRepo.findOne({
      where: {
        club: { id: transaction.clubId },
        category: 'event',
        availableDate: new Date(todayStr + 'T00:00:00'),
        isActive: true
      }
    });

    // If there's an event today, allow menu redemption regardless of club open days
    if (eventToday) {
      return { isValid: true, transaction };
    }

    // If no event today, check club operating days
    if (!club.openDays || !club.openDays.includes(todayDayName)) {
      return { 
        isValid: false, 
        error: `This club is not open on ${todayDayName}. Menu items can only be redeemed when the club is operating.` 
      };
    }

    // Check if club is currently within operating hours
    if (club.openHours && club.openHours.length > 0) {
      const currentHour = today.getHours();
      const currentMinute = today.getMinutes();
      const currentTime = currentHour * 60 + currentMinute; // Convert to minutes since midnight
      
      let isWithinHours = false;
      for (const timeSlot of club.openHours) {
        const [openHour, openMinute] = timeSlot.open.split(':').map(Number);
        const [closeHour, closeMinute] = timeSlot.close.split(':').map(Number);
        
        const openTime = openHour * 60 + openMinute;
        const closeTime = closeHour * 60 + closeMinute;
        
        // Handle overnight hours (e.g., 22:00 - 06:00)
        if (closeTime < openTime) {
          // Overnight hours: check if current time is after open OR before close
          if (currentTime >= openTime || currentTime <= closeTime) {
            isWithinHours = true;
            break;
          }
        } else {
          // Regular hours: check if current time is between open and close
          if (currentTime >= openTime && currentTime <= closeTime) {
            isWithinHours = true;
            break;
          }
        }
      }
      
      if (!isWithinHours) {
        return { 
          isValid: false, 
          error: "This club is currently closed. Menu items can only be redeemed during operating hours." 
        };
      }
    }

    return { isValid: true, transaction };
  } catch (error) {
    return { isValid: false, error: "Invalid QR code" };
  }
}

export async function validateTicketPurchase(
  qrCode: string,
  user: { id: string; role: string; clubId?: string },
  isPreview: boolean = false // New parameter to distinguish between preview and confirmation
): Promise<{
  isValid: boolean;
  purchase?: TicketPurchase;
  error?: string;
  isFutureEvent?: boolean; // New field to indicate if this is a future event
}> {
  try {
    const payload = decryptQR(qrCode);

    if (!validateQRType(payload.type, "ticket")) {
      return { isValid: false, error: "Invalid QR type for ticket validation" };
    }

    if (!payload.id) {
      return { isValid: false, error: "Missing purchase ID in QR code" };
    }

    const purchaseRepository = AppDataSource.getRepository(TicketPurchase);
    const purchase = await purchaseRepository.findOne({
      where: { id: payload.id },
      relations: ["ticket", "ticket.event", "club", "transaction"]
    });

    if (!purchase) {
      return { isValid: false, error: "Purchase not found" };
    }

    const hasAccess = await validateClubAccess(user, purchase.clubId);
    if (!hasAccess) {
      return { isValid: false, error: "Access denied to this club" };
    }

    // For preview: allow any date, but indicate if it's a future event
    if (isPreview) {
      const isFuture = isTicketDateInFuture(purchase.date);
      return { 
        isValid: true, 
        purchase, 
        isFutureEvent: isFuture 
      };
    }

    // For confirmation: check date validity and operating hours
    if (!checkTicketDateIsValid(purchase.date)) {
      // Handle date properly to avoid timezone issues
      const eventDateValue = purchase.date as any; // TypeORM can return date as string or Date
      let eventDateStr: string;
      
      if (typeof eventDateValue === 'string') {
        // If it's a string, extract just the date part (YYYY-MM-DD)
        eventDateStr = eventDateValue.includes('T') ? eventDateValue.split('T')[0] : eventDateValue;
      } else if (eventDateValue instanceof Date) {
        // If it's a Date object, format it properly
        eventDateStr = eventDateValue.toISOString().split('T')[0];
      } else {
        // Fallback: convert to string and handle
        eventDateStr = String(eventDateValue).split('T')[0];
      }
      
      // Parse the date components to create a proper local date
      const [year, month, day] = eventDateStr.split('-').map(Number);
      const displayDate = new Date(year, month - 1, day);
      const eventDateDisplay = displayDate.toLocaleDateString('es-CO', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      const nowUTC = new Date();
      const colombiaOffset = -5 * 60;
      const nowColombia = new Date(nowUTC.getTime() + (colombiaOffset * 60 * 1000));
      const eventStartColombia = new Date(year, month - 1, day, 0, 0, 0);
      
      if (nowColombia < eventStartColombia) {
        return { 
          isValid: false, 
          error: `This ticket is for a future event (${eventDateDisplay}). Valid only on event date.` 
        };
      } else {
        return { 
          isValid: false, 
          error: `This ticket was for ${eventDateDisplay} and is no longer valid (expired at 1:00 AM next day).` 
        };
      }
    }

    // 🎯 SIMPLE RULE: Tickets can only be confirmed on open days, UNLESS there's an event
    const clubRepository = AppDataSource.getRepository(Club);
    const club = await clubRepository.findOne({
      where: { id: purchase.clubId }
    });

    if (!club) {
      return { isValid: false, error: "Club not found" };
    }

    const today = new Date();
    const todayDayName = today.toLocaleString("en-US", { weekday: "long" });
    const todayStr = today.toISOString().split('T')[0];

    // Check if this is an event ticket
    const isEventTicket = purchase.ticket.category === "event";
    
    if (isEventTicket) {
      // For event tickets: Check event open hours if available
      if (purchase.ticket.event && purchase.ticket.event.openHours) {
        const currentHour = today.getHours();
        const currentMinute = today.getMinutes();
        const currentTime = currentHour * 60 + currentMinute; // Convert to minutes since midnight
        
        const { open, close } = purchase.ticket.event.openHours;
        const [openHour, openMinute] = open.split(':').map(Number);
        const [closeHour, closeMinute] = close.split(':').map(Number);
        
        const openTime = openHour * 60 + openMinute;
        const closeTime = closeHour * 60 + closeMinute;
        
        let isWithinEventHours = false;
        
        // Handle overnight hours (e.g., 22:00 - 06:00)
        if (closeTime < openTime) {
          // Overnight hours: check if current time is after open OR before close
          if (currentTime >= openTime || currentTime <= closeTime) {
            isWithinEventHours = true;
          }
        } else {
          // Regular hours: check if current time is between open and close
          if (currentTime >= openTime && currentTime <= closeTime) {
            isWithinEventHours = true;
          }
        }
        
        if (!isWithinEventHours) {
          return { 
            isValid: false, 
            error: `This event ticket is only valid during event hours (${open} - ${close}).` 
          };
        }
      }
      
      // Event tickets are valid on event date regardless of club operating days
      return { isValid: true, purchase };
    } else {
      // For non-event tickets: Check club operating days and hours
      if (!club.openDays || !club.openDays.includes(todayDayName)) {
        return { 
          isValid: false, 
          error: `This club is not open on ${todayDayName}. Tickets can only be redeemed when the club is operating.` 
        };
      }

      // Check if club is currently within operating hours
      if (club.openHours && club.openHours.length > 0) {
        const currentHour = today.getHours();
        const currentMinute = today.getMinutes();
        const currentTime = currentHour * 60 + currentMinute; // Convert to minutes since midnight
        
        let isWithinHours = false;
        for (const timeSlot of club.openHours) {
          const [openHour, openMinute] = timeSlot.open.split(':').map(Number);
          const [closeHour, closeMinute] = timeSlot.close.split(':').map(Number);
          
          const openTime = openHour * 60 + openMinute;
          const closeTime = closeHour * 60 + closeMinute;
          
          // Handle overnight hours (e.g., 22:00 - 06:00)
          if (closeTime < openTime) {
            // Overnight hours: check if current time is after open OR before close
            if (currentTime >= openTime || currentTime <= closeTime) {
              isWithinHours = true;
              break;
            }
          } else {
            // Regular hours: check if current time is between open and close
            if (currentTime >= openTime && currentTime <= closeTime) {
              isWithinHours = true;
              break;
            }
          }
        }
        
        if (!isWithinHours) {
          return { 
            isValid: false, 
            error: "This club is currently closed. Tickets can only be redeemed during operating hours." 
          };
        }
      }
    }

    return { isValid: true, purchase };
  } catch (error) {
    return { isValid: false, error: "Invalid QR code" };
  }
} 

// 🎯 PREVIEW FUNCTION: No restrictions - can be used anytime, any day by bouncers/waiters
export async function previewMenuFromTicketPurchase(
  qrCode: string,
  user: { id: string; role: string; clubId?: string }
): Promise<{
  isValid: boolean;
  purchase?: TicketPurchase;
  error?: string;
  isFutureEvent?: boolean;
}> {
  try {
    const payload = decryptQR(qrCode);

    if (!validateQRType(payload.type, "menu_from_ticket")) {
      return { isValid: false, error: "Invalid QR type for menu from ticket validation" };
    }

    if (!payload.ticketPurchaseId) {
      return { isValid: false, error: "Missing ticket purchase ID in QR code" };
    }

    // Only waiters can validate menu_from_ticket QRs
    if (user.role !== "waiter") {
      return { isValid: false, error: "Only waiters can validate menu QR codes from tickets" };
    }

    const purchaseRepository = AppDataSource.getRepository(TicketPurchase);
    const purchase = await purchaseRepository.findOne({
      where: { id: payload.ticketPurchaseId },
      relations: ["ticket", "club"]
    });

    if (!purchase) {
      return { isValid: false, error: "Ticket purchase not found" };
    }

    const hasAccess = await validateClubAccess(user, purchase.clubId);
    if (!hasAccess) {
      return { isValid: false, error: "Access denied to this club" };
    }

    // Preview has NO time/date restrictions - bouncers/waiters can preview anytime
    const isFuture = isTicketDateInFuture(purchase.date);
    return { 
      isValid: true, 
      purchase, 
      isFutureEvent: isFuture 
    };
  } catch (error) {
    return { isValid: false, error: "Invalid QR code" };
  }
}

export async function validateMenuFromTicketPurchase(
  qrCode: string,
  user: { id: string; role: string; clubId?: string },
  isPreview: boolean = false // New parameter to distinguish between preview and confirmation
): Promise<{
  isValid: boolean;
  purchase?: TicketPurchase;
  error?: string;
  isFutureEvent?: boolean; // New field to indicate if this is a future event
}> {
  try {
    const payload = decryptQR(qrCode);

    if (!validateQRType(payload.type, "menu_from_ticket")) {
      return { isValid: false, error: "Invalid QR type for menu from ticket validation" };
    }

    if (!payload.ticketPurchaseId) {
      return { isValid: false, error: "Missing ticket purchase ID in QR code" };
    }

    // Only waiters can validate menu_from_ticket QRs
    if (user.role !== "waiter") {
      return { isValid: false, error: "Only waiters can validate menu QR codes from tickets" };
    }

    const purchaseRepository = AppDataSource.getRepository(TicketPurchase);
    const purchase = await purchaseRepository.findOne({
      where: { id: payload.ticketPurchaseId },
      relations: ["ticket", "club"]
    });

    if (!purchase) {
      return { isValid: false, error: "Ticket purchase not found" };
    }

    const hasAccess = await validateClubAccess(user, purchase.clubId);
    if (!hasAccess) {
      return { isValid: false, error: "Access denied to this club" };
    }

    // For preview: allow any date, but indicate if it's a future event
    if (isPreview) {
      const isFuture = isTicketDateInFuture(purchase.date);
      return { 
        isValid: true, 
        purchase, 
        isFutureEvent: isFuture 
      };
    }

    // For confirmation: check if already used and date validity
    if (purchase.isUsedMenu) {
      return { isValid: false, error: "Menu QR already used" };
    }

    // Check if ticket date is valid (same logic as ticket validation)
    if (!checkTicketDateIsValid(purchase.date)) {
      const eventDateValue = purchase.date as any;
      let eventDateStr: string;
      
      if (typeof eventDateValue === 'string') {
        eventDateStr = eventDateValue.includes('T') ? eventDateValue.split('T')[0] : eventDateValue;
      } else if (eventDateValue instanceof Date) {
        eventDateStr = eventDateValue.toISOString().split('T')[0];
      } else {
        eventDateStr = String(eventDateValue).split('T')[0];
      }
      
      const [year, month, day] = eventDateStr.split('-').map(Number);
      const displayDate = new Date(year, month - 1, day);
      const eventDateDisplay = displayDate.toLocaleDateString('es-CO', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      const nowUTC = new Date();
      const colombiaOffset = -5 * 60;
      const nowColombia = new Date(nowUTC.getTime() + (colombiaOffset * 60 * 1000));
      const eventStartColombia = new Date(year, month - 1, day, 0, 0, 0);
      
      if (nowColombia < eventStartColombia) {
        return { 
          isValid: false, 
          error: `This menu QR is for a future event (${eventDateDisplay}). Valid only on event date.` 
        };
      } else {
        return { 
          isValid: false, 
          error: `This menu QR was for ${eventDateDisplay} and is no longer valid (expired at 1:00 AM next day).` 
        };
      }
    }

    // 🎯 SIMPLE RULE: Menu items can only be confirmed on open days, UNLESS there's an event
    const clubRepository = AppDataSource.getRepository(Club);
    const club = await clubRepository.findOne({
      where: { id: purchase.clubId }
    });

    if (!club) {
      return { isValid: false, error: "Club not found" };
    }

    const today = new Date();
    const todayDayName = today.toLocaleString("en-US", { weekday: "long" });
    const todayStr = today.toISOString().split('T')[0];

    // Check if there's an event happening today
    const ticketRepo = AppDataSource.getRepository('Ticket');
    const eventToday = await ticketRepo.findOne({
      where: {
        club: { id: purchase.clubId },
        category: 'event',
        availableDate: new Date(todayStr + 'T00:00:00'),
        isActive: true
      }
    });

    // If there's an event today, allow menu redemption regardless of club open days
    if (eventToday) {
      return { isValid: true, purchase };
    }

    // If no event today, check club operating days
    if (!club.openDays || !club.openDays.includes(todayDayName)) {
      return { 
        isValid: false, 
        error: `This club is not open on ${todayDayName}. Menu items can only be redeemed when the club is operating.` 
      };
    }

    // Check if club is currently within operating hours
    if (club.openHours && club.openHours.length > 0) {
      const currentHour = today.getHours();
      const currentMinute = today.getMinutes();
      const currentTime = currentHour * 60 + currentMinute; // Convert to minutes since midnight
      
      let isWithinHours = false;
      for (const timeSlot of club.openHours) {
        const [openHour, openMinute] = timeSlot.open.split(':').map(Number);
        const [closeHour, closeMinute] = timeSlot.close.split(':').map(Number);
        
        const openTime = openHour * 60 + openMinute;
        const closeTime = closeHour * 60 + closeMinute;
        
        // Handle overnight hours (e.g., 22:00 - 06:00)
        if (closeTime < openTime) {
          // Overnight hours: check if current time is after open OR before close
          if (currentTime >= openTime || currentTime <= closeTime) {
            isWithinHours = true;
            break;
          }
        } else {
          // Regular hours: check if current time is between open and close
          if (currentTime >= openTime && currentTime <= closeTime) {
            isWithinHours = true;
            break;
          }
        }
      }
      
      if (!isWithinHours) {
        return { 
          isValid: false, 
          error: "This club is currently closed. Menu items can only be redeemed during operating hours." 
        };
      }
    }

    return { isValid: true, purchase };
  } catch (error) {
    return { isValid: false, error: "Invalid QR code" };
  }
} 