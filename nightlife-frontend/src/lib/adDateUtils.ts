/**
 * Date helpers that avoid timezone surprises (construct Date(y, m-1, d)).
 */

type TicketLike = {
    availableDate?: string | null;
    // You can add fields if needed later
  };
  
  type ClubLike = {
    openDays?: number[] | string[]; // 0..6 (Sun..Sat). Strings also supported ("0","1",...)
  };
  
  /** Convert a safe Date to YYYY-MM-DD */
  export function dateToYMD(d: Date): string {
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, "0");
    const day = `${d.getDate()}`.padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  
  /** Parse "YYYY-MM-DD" or ISO into a safe Date via components */
  export function parseYMD(s: string): Date {
    // Try to detect YYYY-MM-DD explicitly
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const y = parseInt(m[1], 10);
      const mo = parseInt(m[2], 10);
      const d = parseInt(m[3], 10);
      return new Date(y, mo - 1, d);
    }
    // Fallback: new Date(...) then normalize to Y-M-D
    const d = new Date(s);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  
  function tomorrow(): Date {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  
  function today(): Date {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  
  /**
   * Find the next day (>= today) whose weekday is included in openDays.
   * If openDays is missing/invalid → return tomorrow().
   */
  function nextOpenDay(openDays?: number[] | string[]): Date {
    if (!openDays || openDays.length === 0) return tomorrow();
  
    // Normalize to number[]
    const days = openDays.map((v: any) => Number(v)).filter((n) => n >= 0 && n <= 6);
    if (days.length === 0) return tomorrow();
  
    const base = today();
    for (let i = 0; i < 14; i++) {
      const candidate = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      const weekday = candidate.getDay(); // 0..6
      if (days.includes(weekday)) return candidate;
    }
    // Fallback if nothing matches within 2 weeks
    return tomorrow();
  }
  
  /**
   * Choose the best date for a ticket:
   * - If ticket.availableDate exists → use it
   * - Else → use club.openDays to pick the next available day
   * - If club.openDays missing → fallback to tomorrow
   */
  export async function pickBestDateForTicket(
    ticket: TicketLike,
    club: ClubLike
  ): Promise<Date | null> {
    if (ticket.availableDate) {
      return parseYMD(ticket.availableDate);
    }
    return nextOpenDay(club.openDays);
  }
  