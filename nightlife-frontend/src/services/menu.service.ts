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

  // Normalize menu items defensively and ensure dynamic pricing is properly structured
  const normalizeMenuItem = (item: any): MenuItemDTO => ({
    id: String(item.id),
    name: String(item.name),
    description: item.description ?? null,
    imageUrl: item.imageUrl ?? null,
    imageBlurhash: item.imageBlurhash ?? null,
    price: item.price ?? null,
    dynamicPricingEnabled: !!item.dynamicPricingEnabled,
    dynamicPrice: item.dynamicPrice ?? null,
    clubId: String(item.clubId),
    categoryId: String(item.categoryId),
    category: item.category ? {
      id: String(item.category.id),
      name: String(item.category.name),
      clubId: String(item.category.clubId),
      isActive: !!item.category.isActive,
    } : null,
    maxPerPerson: item.maxPerPerson ? Number(item.maxPerPerson) : null,
    hasVariants: !!item.hasVariants,
    isActive: !!item.isActive,
    isDeleted: !!item.isDeleted,
    variants: Array.isArray(item.variants)
      ? item.variants.map((variant: any) => ({
          id: String(variant.id),
          name: String(variant.name),
          price: variant.price,
          dynamicPricingEnabled: !!variant.dynamicPricingEnabled,
          dynamicPrice: variant.dynamicPrice ?? null,
          maxPerPerson: variant.maxPerPerson ? Number(variant.maxPerPerson) : null,
          isActive: !!variant.isActive,
          isDeleted: !!variant.isDeleted,
        }))
      : [],
  });

  // Normalize categories and their items
  data.categories = Array.isArray(data.categories) 
    ? data.categories.map((category: any) => ({
        id: String(category.id),
        name: String(category.name),
        items: Array.isArray(category.items) 
          ? category.items.map(normalizeMenuItem)
          : [],
      }))
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
