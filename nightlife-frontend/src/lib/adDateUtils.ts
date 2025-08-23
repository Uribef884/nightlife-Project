// src/lib/adDateUtils.ts
type TicketLike = { availableDate?: string | null };
type ClubLike = { openDays?: number[] | string[]; openHours?: { day: string }[] };

export function dateToYMD(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseYMD(s: string): Date {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(s);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function today(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function tomorrow(): Date {
  const t = today();
  t.setDate(t.getDate() + 1);
  return t;
}

// Normalize various club open-day shapes to weekday indices (0..6)
function normalizeOpenDayIndices(club: ClubLike): number[] {
  const set = new Set<number>();
  const map: Record<string, number> = {
    sunday: 0, sun: 0, domingo: 0, dom: 0,
    monday: 1, mon: 1, lunes: 1, lun: 1,
    tuesday: 2, tue: 2, tues: 2, martes: 2, mar: 2,
    wednesday: 3, wed: 3, miercoles: 3, miércoles: 3, mie: 3,
    thursday: 4, thu: 4, thur: 4, thurs: 4, jueves: 4, jue: 4,
    friday: 5, fri: 5, viernes: 5, vie: 5,
    saturday: 6, sat: 6, sabado: 6, sábado: 6, sab: 6,
  };

  if (Array.isArray(club.openDays)) {
    for (const v of club.openDays) {
      const key = String(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f.]/g, "");
      if (key in map) set.add(map[key]);
      const num = Number(v);
      if (Number.isFinite(num) && num >= 0 && num <= 6) set.add(num);
    }
  }
  if (Array.isArray(club.openHours)) {
    for (const oh of club.openHours) {
      const key = String(oh.day).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f.]/g, "");
      if (key in map) set.add(map[key]);
    }
  }
  return [...set];
}

function nextOpenDay(club: ClubLike): Date {
  const idx = normalizeOpenDayIndices(club);
  if (idx.length === 0) return tomorrow();

  const base = today();
  for (let i = 0; i < 14; i++) {
    const cand = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    if (idx.includes(cand.getDay())) return cand;
  }
  return tomorrow();
}

// Pick the best date for a ticket.
// - If ticket.availableDate exists → use it
// - Else → choose next open day from the club (closest day for that ticket)
// - Else → tomorrow
export async function pickBestDateForTicket(ticket: TicketLike, club: ClubLike): Promise<Date> {
  if (ticket.availableDate) return parseYMD(ticket.availableDate);
  return nextOpenDay(club);
}
