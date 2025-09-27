// src/services/menu.service.ts
"use client";

import { API_BASE_CSR, joinUrl } from "@/lib/env";

/** Basic DTOs aligned with your payloads */
export type MenuCategoryDTO = {
  id: string;
  name: string;
  clubId: string;
  isActive?: boolean;
};

export type MenuVariantDTO = {
  id: string;
  name: string;
  price: number | string; // API sometimes returns string
  dynamicPricingEnabled?: boolean;
  dynamicPrice?: number | string; // API sometimes returns string
  maxPerPerson?: number | null;
  isActive?: boolean;
  isDeleted?: boolean;
};

export type MenuItemDTO = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  imageBlurhash?: string | null;
  price: number | null;                 // null if hasVariants
  dynamicPricingEnabled?: boolean;
  dynamicPrice?: number | string | null; // API sometimes returns string
  clubId: string;
  categoryId: string;
  category?: MenuCategoryDTO | null;    // may be present
  maxPerPerson?: number | null;         // null if hasVariants
  hasVariants: boolean;
  isActive?: boolean;
  isDeleted?: boolean;
  variants?: MenuVariantDTO[];          // purchase happens on variants when present
};

export type MenuCartSummary = {
  items: Array<{
    id: string;                    // cart line id
    menuItemId: string;
    variantId?: string | null;
    quantity: number;
    // (Optionally) price, name, etc… we don't rely on it here
  }>;
};

export type AvailableMenuResponse = {
  clubId: string;
  date: string; // YYYY-MM-DD
  dateHasEvent: boolean;
  event: {
    id: string;
    name: string;
    availableDate: string; // YYYY-MM-DD
    bannerUrl: string | null;
  } | null;
  categories: Array<{
    id: string;
    name: string;
    items: MenuItemDTO[];
  }>;
};

/** GET public menu items for a club */
export async function getMenuItemsForClubCSR(clubId: string, selectedDate?: string): Promise<MenuItemDTO[]> {
  const url = selectedDate 
    ? joinUrl(API_BASE_CSR, `/menu/items/club/${encodeURIComponent(clubId)}?date=${encodeURIComponent(selectedDate)}`)
    : joinUrl(API_BASE_CSR, `/menu/items/club/${encodeURIComponent(clubId)}`);
  
  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("No se pudo cargar el menú.");
  const data = await res.json();
  return Array.isArray(data) ? (data as MenuItemDTO[]) : [];
}

/**
 * Fetch menu items available for a club on a given local date (YYYY-MM-DD) with event information.
 * - Uses no-store to avoid stale cache while selecting dates
 * - Throws on non-2xx status so callers can handle/display errors
 * - Returns event information and properly priced menu items
 */
export async function getAvailableMenuForDate(
  clubId: string,
  dateISO: string
): Promise<AvailableMenuResponse> {
  if (!clubId || !dateISO) {
    throw new Error("clubId and dateISO are required");
  }

  const url = joinUrl(API_BASE_CSR, `/menu/items/available/${encodeURIComponent(clubId)}/${encodeURIComponent(dateISO)}`);

  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Failed to fetch available menu (${res.status}): ${text || res.statusText}`
    );
  }

  const data = (await res.json()) as AvailableMenuResponse;

  // Local types for backend data structures
  type BackendMenuItem = {
    id: unknown;
    name: unknown;
    description?: unknown;
    imageUrl?: unknown;
    imageBlurhash?: unknown;
    price?: unknown;
    dynamicPricingEnabled?: unknown;
    dynamicPrice?: unknown;
    clubId: unknown;
    categoryId: unknown;
    category?: {
      id: unknown;
      name: unknown;
      clubId: unknown;
      isActive?: unknown;
    };
    maxPerPerson?: unknown;
    hasVariants?: unknown;
    isActive?: unknown;
    isDeleted?: unknown;
    variants?: BackendMenuVariant[];
  };

  type BackendMenuVariant = {
    id: unknown;
    name: unknown;
    price: unknown;
    dynamicPricingEnabled?: unknown;
    dynamicPrice?: unknown;
    maxPerPerson?: unknown;
    isActive?: unknown;
    isDeleted?: unknown;
  };

  type BackendCategory = {
    id: unknown;
    name: unknown;
    items?: BackendMenuItem[];
  };

  // Normalize menu items defensively and ensure dynamic pricing is properly structured
  const normalizeMenuItem = (item: unknown): MenuItemDTO => {
    const menuItem = item as BackendMenuItem;
    return {
      id: String(menuItem.id),
      name: String(menuItem.name),
      description: menuItem.description ? String(menuItem.description) : null,
      imageUrl: menuItem.imageUrl ? String(menuItem.imageUrl) : null,
      imageBlurhash: menuItem.imageBlurhash ? String(menuItem.imageBlurhash) : null,
      price: typeof menuItem.price === 'number' ? menuItem.price : 
             typeof menuItem.price === 'string' ? Number(menuItem.price) : null,
      dynamicPricingEnabled: !!menuItem.dynamicPricingEnabled,
      dynamicPrice: typeof menuItem.dynamicPrice === 'number' ? menuItem.dynamicPrice :
                   typeof menuItem.dynamicPrice === 'string' ? menuItem.dynamicPrice : undefined,
      clubId: String(menuItem.clubId),
      categoryId: String(menuItem.categoryId),
      category: menuItem.category ? {
        id: String(menuItem.category.id),
        name: String(menuItem.category.name),
        clubId: String(menuItem.category.clubId),
        isActive: !!menuItem.category.isActive,
      } : null,
      maxPerPerson: menuItem.maxPerPerson ? Number(menuItem.maxPerPerson) : null,
      hasVariants: !!menuItem.hasVariants,
      isActive: !!menuItem.isActive,
      isDeleted: !!menuItem.isDeleted,
      variants: Array.isArray(menuItem.variants)
        ? menuItem.variants.map((variant: BackendMenuVariant) => ({
            id: String(variant.id),
            name: String(variant.name),
            price: typeof variant.price === 'number' ? variant.price :
                   typeof variant.price === 'string' ? variant.price : 0,
            dynamicPricingEnabled: !!variant.dynamicPricingEnabled,
            dynamicPrice: typeof variant.dynamicPrice === 'number' ? variant.dynamicPrice :
                         typeof variant.dynamicPrice === 'string' ? variant.dynamicPrice : undefined,
            maxPerPerson: variant.maxPerPerson ? Number(variant.maxPerPerson) : null,
            isActive: !!variant.isActive,
            isDeleted: !!variant.isDeleted,
          }))
        : [],
    };
  };

  // Normalize categories and their items
  data.categories = Array.isArray(data.categories) 
    ? data.categories.map((category: unknown) => {
        const cat = category as BackendCategory;
        return {
          id: String(cat.id),
          name: String(cat.name),
          items: Array.isArray(cat.items) 
            ? cat.items.map(normalizeMenuItem)
            : [],
        };
      })
    : [];

  return data;
}

/** MENU CART — Add (no variant) */
export async function addMenuItemToCart(input: { menuItemId: string; quantity: number; date: string }): Promise<void> {
  const url = joinUrl(API_BASE_CSR, `/unified-cart/add`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      itemType: 'menu',
      menuItemId: input.menuItemId,
      quantity: input.quantity,
      date: input.date
    }),
  });
  if (!res.ok) throw new Error("No se pudo agregar al carrito.");
}

/** MENU CART — Add (with variant) */
export async function addMenuVariantToCart(input: { menuItemId: string; variantId: string; quantity: number; date: string }): Promise<void> {
  const url = joinUrl(API_BASE_CSR, `/unified-cart/add`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      itemType: 'menu',
      menuItemId: input.menuItemId,
      variantId: input.variantId,
      quantity: input.quantity,
      date: input.date
    }),
  });
  if (!res.ok) throw new Error("No se pudo agregar la variante al carrito.");
}

/** MENU CART — Update qty */
export async function updateMenuCartQty(input: { id: string; quantity: number }): Promise<void> {
  const url = joinUrl(API_BASE_CSR, `/unified-cart/update`);
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("No se pudo actualizar el carrito.");
}

/** MENU CART — Remove a line item */
export async function removeMenuCartItem(cartItemId: string): Promise<void> {
  const url = joinUrl(API_BASE_CSR, `/unified-cart/item/${encodeURIComponent(cartItemId)}`);
  const res = await fetch(url, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("No se pudo eliminar el item del carrito.");
}

/** MENU CART — Get summary */
export async function getMenuCartSummaryCSR(): Promise<MenuCartSummary> {
  const url = joinUrl(API_BASE_CSR, `/unified-cart/summary`);
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo obtener el carrito del menú.");
  return (await res.json()) as MenuCartSummary;
}

/** MENU CART — Clear only menu cart */
export async function clearMenuCartCSR(): Promise<void> {
  const url = joinUrl(API_BASE_CSR, `/unified-cart/clear`);
  const res = await fetch(url, { method: "DELETE", cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo limpiar el carrito del menú.");
}

/** MENU CART — Clear the OTHER cart (Tickets) */
export async function clearTicketCartForMenuCSR(): Promise<void> {
  const url = joinUrl(API_BASE_CSR, `/unified-cart/clear-other-cart`);
  const res = await fetch(url, { method: "DELETE", cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo limpiar el carrito de entradas.");
}
