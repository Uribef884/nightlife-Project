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

/** GET public menu items for a club */
export async function getMenuItemsForClubCSR(clubId: string): Promise<MenuItemDTO[]> {
  const url = joinUrl(API_BASE_CSR, `/menu/items/club/${encodeURIComponent(clubId)}`);
  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("No se pudo cargar el menú.");
  const data = await res.json();
  return Array.isArray(data) ? (data as MenuItemDTO[]) : [];
}

/** MENU CART — Add (no variant) */
export async function addMenuItemToCart(input: { menuItemId: string; quantity: number }): Promise<void> {
  const url = joinUrl(API_BASE_CSR, `/menu/cart/add`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("No se pudo agregar al carrito.");
}

/** MENU CART — Add (with variant) */
export async function addMenuVariantToCart(input: { menuItemId: string; variantId: string; quantity: number }): Promise<void> {
  const url = joinUrl(API_BASE_CSR, `/menu/cart/add`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("No se pudo agregar la variante al carrito.");
}

/** MENU CART — Update qty */
export async function updateMenuCartQty(input: { id: string; quantity: number }): Promise<void> {
  const url = joinUrl(API_BASE_CSR, `/menu/cart/update`);
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
  const url = joinUrl(API_BASE_CSR, `/menu/cart/item/${encodeURIComponent(cartItemId)}`);
  const res = await fetch(url, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("No se pudo eliminar el item del carrito.");
}

/** MENU CART — Get summary */
export async function getMenuCartSummaryCSR(): Promise<MenuCartSummary> {
  const url = joinUrl(API_BASE_CSR, `/menu/cart/summary`);
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo obtener el carrito del menú.");
  return (await res.json()) as MenuCartSummary;
}

/** MENU CART — Clear only menu cart */
export async function clearMenuCartCSR(): Promise<void> {
  const url = joinUrl(API_BASE_CSR, `/menu/cart/clear`);
  const res = await fetch(url, { method: "DELETE", cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo limpiar el carrito del menú.");
}

/** MENU CART — Clear the OTHER cart (Tickets) */
export async function clearTicketCartForMenuCSR(): Promise<void> {
  const url = joinUrl(API_BASE_CSR, `/menu/cart/clear-other-cart`);
  const res = await fetch(url, { method: "DELETE", cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo limpiar el carrito de entradas.");
}
