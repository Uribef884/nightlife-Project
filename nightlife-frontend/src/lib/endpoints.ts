// src/lib/endpoints.ts
// Centralized list of backend endpoints used by the frontend.

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ?? "http://localhost:4000";

// --- Public data ---
export const ENDPOINTS = {
  health: `${API_BASE}/health`, // if you have one; safe to keep

  clubs: {
    list: `${API_BASE}/clubs`,
    byId: (clubId: string) => `${API_BASE}/clubs/${encodeURIComponent(clubId)}`,
  },

  ads: {
    global: `${API_BASE}/ads`,
    byClub: (clubId: string) => `${API_BASE}/ads/club/${encodeURIComponent(clubId)}`,
  },

  events: {
    byClub: (clubId: string) => `${API_BASE}/events/club/${encodeURIComponent(clubId)}`,
    byId: (eventId: string) => `${API_BASE}/events/${encodeURIComponent(eventId)}`,
  },

  tickets: {
    // You can adapt this if your backend expects other query params
    byClubAndDate: (clubId: string, yyyyMmDd: string) =>
      `${API_BASE}/tickets?clubId=${encodeURIComponent(clubId)}&date=${encodeURIComponent(yyyyMmDd)}`,
  },

  // --- Auth / CSRF ---
  auth: {
    me: `${API_BASE}/auth/me`,
    login: `${API_BASE}/auth/login`,
    logout: `${API_BASE}/auth/logout`,
    register: `${API_BASE}/auth/register`,
    csrf: `${API_BASE}/auth/csrf`, // if not present yet, frontend will handle null
  },

  // --- Ticket Cart (mounted at /cart in your index.ts) ---
  ticketCart: {
    root: `${API_BASE}/cart`,
    byId: (id: string) => `${API_BASE}/cart/${encodeURIComponent(id)}`,
  },

  // --- Menu Cart / Menu system ---
  menu: {
    categories: `${API_BASE}/menu/categories`,
    items: `${API_BASE}/menu/items`,
    variants: `${API_BASE}/menu/variants`,
    config: `${API_BASE}/menu`, // menuConfig routes
    cart: {
      root: `${API_BASE}/menu/cart`,
      byId: (id: string) => `${API_BASE}/menu/cart/${encodeURIComponent(id)}`,
    },
    checkout: {
      initiate: `${API_BASE}/menu/checkout`, // adjust if needed
      status: (orderId: string) => `${API_BASE}/menu/checkout/status?orderId=${encodeURIComponent(orderId)}`,
    },
    purchases: `${API_BASE}/menu/purchases`,
  },

  // --- Ticket Checkout (non-Wompi generic) ---
  checkout: {
    initiate: `${API_BASE}/checkout`,
    status: (orderId: string) => `${API_BASE}/checkout/status?orderId=${encodeURIComponent(orderId)}`,
  },

  // --- Wompi (you also expose these) ---
  wompi: {
    tickets: {
      initiate: `${API_BASE}/wompi/tickets/initiate`,
      checkout: `${API_BASE}/wompi/tickets/checkout`,
    },
    menu: {
      initiate: `${API_BASE}/wompi/menu/initiate`,
      checkout: `${API_BASE}/wompi/menu/checkout`,
    },
  },

  // --- Purchases ---
  purchases: {
    mine: `${API_BASE}/purchases`,
    byId: (id: string) => `${API_BASE}/purchases/${encodeURIComponent(id)}`,
  },

  // --- Validation (QR) ---
  validate: {
    ticket: `${API_BASE}/validate/ticket`,
    menu: `${API_BASE}/validate/menu`,
    menuFromTicket: `${API_BASE}/validate/menu-from-ticket`,
  },

  // --- Ticket includes menu items ---
  ticketMenu: {
    root: `${API_BASE}/ticket-menu`,
  },

  // --- File upload ---
  upload: `${API_BASE}/upload`,

  // --- Admin ---
  admin: `${API_BASE}/admin`,
} as const;
