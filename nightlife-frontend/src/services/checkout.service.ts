// src/services/checkout.service.ts
import { API_BASE_CSR, joinUrl } from "@/lib/env";

// Types for Wompi integration
export interface WompiAcceptanceTokens {
  data: {
    presigned_acceptance: {
      acceptance_token: string;
      permalink: string;
      type: string;
    };
    presigned_personal_data_auth: {
      acceptance_token: string;
      permalink: string;
      type: string;
    };
  };
}

export interface CheckoutInitiateRequest {
  email: string;
  paymentMethod: string;
  paymentData: any;
  installments?: number;
  redirect_url?: string;
  customer_data?: {
    phone_number?: string;
    full_name?: string;
  };
  customerInfo: {
    fullName?: string;
    phoneNumber?: string;
    legalId?: string;
    legalIdType?: string;
    paymentMethod: string;
  };
}

export interface CheckoutInitiateResponse {
  success: boolean;
  transactionId?: string;
  wompiTransactionId?: string;
  wompiStatus?: string;
  status?: string;
  totalPaid?: number;
  total?: number;
  subtotal?: number;
  serviceFee?: number;
  discounts?: number;
  actualTotal?: number;
  clubReceives?: number;
  platformReceives?: number;
  isFreeCheckout?: boolean;
  redirectUrl?: string;
  requiresRedirect?: boolean;
  otpUrl?: string;
  message?: string;
  error?: string;
  declineReason?: string;
  errorCode?: string;
  errorMessage?: string;
  timeoutDuration?: number;
}

export interface CheckoutStatusResponse {
  success: boolean;
  transactionId?: string;
  status?: string;
  amount?: number;
  currency?: string;
  customerEmail?: string;
  createdAt?: string;
  finalizedAt?: string;
  isFreeCheckout?: boolean;
  lineItemsCount?: number;
  error?: string;
}

export interface PSEBank {
  financial_institution_code: string;
  financial_institution_name: string;
}

export interface PSEBanksResponse {
  success: boolean;
  data?: PSEBank[];
  error?: string;
}

const JSON_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
} as const;

async function parseJsonSafe<T>(resp: Response): Promise<T> {
  const text = await resp.text().catch(() => "");
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

function assertOk(resp: Response, label: string) {
  if (!resp.ok) {
    throw new Error(`${label} failed (${resp.status})`);
  }
}

/**
 * Get Wompi acceptance tokens for privacy policy and personal data processing
 */
export async function getAcceptanceTokens(): Promise<WompiAcceptanceTokens> {
  const resp = await fetch(joinUrl(API_BASE_CSR, "/checkout/unified/acceptance-tokens"), {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  assertOk(resp, "getAcceptanceTokens");
  return parseJsonSafe<WompiAcceptanceTokens>(resp);
}

/**
 * Get PSE banks for PSE payment method
 */
export async function getPSEBanks(): Promise<PSEBanksResponse> {
  const resp = await fetch(joinUrl(API_BASE_CSR, "/api/pse/banks"), {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  assertOk(resp, "getPSEBanks");
  return parseJsonSafe<PSEBanksResponse>(resp);
}

/**
 * Initiate unified checkout with Wompi integration
 */
export async function initiateCheckout(request: CheckoutInitiateRequest): Promise<CheckoutInitiateResponse> {
  const resp = await fetch(joinUrl(API_BASE_CSR, "/checkout/unified/initiate"), {
    method: "POST",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify(request),
  });
  
  if (!resp.ok) {
    const errorData = await parseJsonSafe<{ error?: string; message?: string }>(resp);
    return {
      success: false,
      error: errorData.error || errorData.message || `Request failed with status ${resp.status}`
    };
  }
  
  return parseJsonSafe<CheckoutInitiateResponse>(resp);
}

/**
 * Check transaction status
 */
export async function checkTransactionStatus(transactionId: string): Promise<CheckoutStatusResponse> {
  const resp = await fetch(joinUrl(API_BASE_CSR, `/checkout/unified/status/${transactionId}`), {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  
  if (!resp.ok) {
    const errorData = await parseJsonSafe<{ error?: string; message?: string }>(resp);
    return {
      success: false,
      error: errorData.error || errorData.message || `Request failed with status ${resp.status}`
    };
  }
  
  return parseJsonSafe<CheckoutStatusResponse>(resp);
}

/**
 * Get cart summary for checkout
 */
export async function getCartSummary() {
  const resp = await fetch(joinUrl(API_BASE_CSR, "/unified-cart/summary"), {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  assertOk(resp, "getCartSummary");
  return parseJsonSafe<any>(resp);
}
