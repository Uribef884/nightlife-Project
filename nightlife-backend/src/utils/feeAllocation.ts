import { getTicketCommissionRate, getMenuCommissionRate, GATEWAY_FEES } from '../config/fees';

export interface FeeAllocationInput {
  ticketSubtotal: number;
  menuSubtotal: number;
  isEventTicket?: boolean;
}

export interface FeeAllocationResult {
  // Subtotals
  ticketSubtotal: number;
  menuSubtotal: number;
  totalSubtotal: number;

  // Platform fees
  platformFeeTickets: number;
  platformFeeMenu: number;
  platformReceives: number;

  // Gateway fees (computed on total + platform fees)
  gatewayFee: number;
  gatewayIVA: number;
  gatewayTotal: number;

  // Gateway fee allocation (proportional by subtotal weight)
  gatewayAllocTickets: number;
  gatewayAllocMenu: number;

  // Retenciones (if applicable)
  retencionICA?: number;
  retencionIVA?: number;
  retencionFuente?: number;

  // Final totals
  totalPaid: number;
  clubReceives: number;
}

// Legacy compatibility interfaces for existing code
export interface LegacyTicketFeeInput {
  basePrice: number;
  isEventTicket?: boolean;
}

export interface LegacyMenuFeeInput {
  totalPaid: number;
  paymentMethod: string;
  platformFeeApplied: number;
}

export interface LegacyTicketFeeResult {
  totalGatewayFee: number;
  iva: number;
}

export interface LegacyMenuFeeResult {
  platformReceives: number;
  clubReceives: number;
  gatewayFee: number;
  gatewayIVA: number;
  retentionFuente: number | null;
  retentionICA: number | null;
  retentionIVA: number | null;
}

/**
 * Core fee allocation logic preserving 5% tickets vs 2.5% menu platform fees
 * Goal: One Wompi charge; preserve platform fee rules; club receives 100% of item value; gateway/retenciones added on top
 * 
 * Formula:
 * - ItemTotalTickets = all tickets summed
 * - itemTotalMenu = all menu items summed  
 * - Nightlife commission unified = (ItemTotalTickets*ticketsFee)+(itemTotalMenu*menuFee)
 * - Gateway unified = ((ItemTotalTickets+itemTotalMenu + nightlifecomission)*0.0265)+700
 * - gatewayIva unified = Gateway unified*0.19
 * - totalPaid = ItemTotalTickets+itemTotalMenu+nightlifecomission+gatewayunified+gatewayIva
 */
export function calculateFeeAllocation(input: FeeAllocationInput): FeeAllocationResult {
  const { ticketSubtotal, menuSubtotal, isEventTicket = false } = input;

  // Step 1: Calculate platform fees by category
  const ticketCommissionRate = getTicketCommissionRate(isEventTicket);
  const menuCommissionRate = getMenuCommissionRate();

  const platformFeeTickets = ticketSubtotal * ticketCommissionRate;
  const platformFeeMenu = menuSubtotal * menuCommissionRate;
  const platformReceives = platformFeeTickets + platformFeeMenu;

  // Step 2: Calculate total before gateway fees
  const totalSubtotal = ticketSubtotal + menuSubtotal;
  const subtotalWithPlatformFees = totalSubtotal + platformReceives;

  // Step 3: Calculate gateway fees using the exact formula provided
  // Gateway unified = ((ItemTotalTickets+itemTotalMenu +itemTotalTickets + nightlifecomission )*0.0265)+700
  const gatewayFee = ((totalSubtotal + platformReceives) * 0.0265) + 700;
  
  // Gateway IVA unified = Gateway unified * 0.19
  const gatewayIVA = gatewayFee * 0.19;
  const gatewayTotal = gatewayFee + gatewayIVA;

  // Step 4: Allocate gateway fees proportionally by subtotal weight
  const ticketWeight = ticketSubtotal / totalSubtotal;
  const menuWeight = menuSubtotal / totalSubtotal;

  const gatewayAllocTickets = gatewayTotal * ticketWeight;
  const gatewayAllocMenu = gatewayTotal * menuWeight;

  // Step 5: Calculate final totals
  // totalPaid = ItemTotalTickets+itemTotalMenu+nightlifecomission+gatewayunified+gatewayIva
  const totalPaid = totalSubtotal + platformReceives + gatewayFee + gatewayIVA;
  const clubReceives = totalSubtotal; // Club receives 100% of item value (fees are on top)

  return {
    // Subtotals
    ticketSubtotal,
    menuSubtotal,
    totalSubtotal,

    // Platform fees
    platformFeeTickets,
    platformFeeMenu,
    platformReceives,

    // Gateway fees
    gatewayFee,
    gatewayIVA,
    gatewayTotal,

    // Gateway fee allocation
    gatewayAllocTickets,
    gatewayAllocMenu,

    // Final totals
    totalPaid,
    clubReceives,
  };
}

/**
 * Helper function to validate fee allocation results
 */
export function validateFeeAllocation(result: FeeAllocationResult): boolean {
  const tolerance = 0.01; // 1 cent tolerance for floating point precision

  // Check that gateway allocation adds up to total
  const gatewayAllocTotal = result.gatewayAllocTickets + result.gatewayAllocMenu;
  if (Math.abs(gatewayAllocTotal - result.gatewayTotal) > tolerance) {
    console.error('Gateway fee allocation mismatch:', {
      allocated: gatewayAllocTotal,
      total: result.gatewayTotal,
      difference: Math.abs(gatewayAllocTotal - result.gatewayTotal)
    });
    return false;
  }

  // Check that platform fees add up
  const platformTotal = result.platformFeeTickets + result.platformFeeMenu;
  if (Math.abs(platformTotal - result.platformReceives) > tolerance) {
    console.error('Platform fee calculation mismatch:', {
      calculated: platformTotal,
      stored: result.platformReceives,
      difference: Math.abs(platformTotal - result.platformReceives)
    });
    return false;
  }

  // Check that club receives exactly the subtotal
  if (Math.abs(result.clubReceives - result.totalSubtotal) > tolerance) {
    console.error('Club receives calculation mismatch:', {
      clubReceives: result.clubReceives,
      totalSubtotal: result.totalSubtotal,
      difference: Math.abs(result.clubReceives - result.totalSubtotal)
    });
    return false;
  }

  return true;
}

// ============================================================================
// LEGACY COMPATIBILITY FUNCTIONS
// These functions provide backward compatibility for existing code during the
// transition from legacy cart/checkout to unified system.
// ============================================================================

/**
 * Legacy ticket fee calculation (for backward compatibility)
 * @deprecated Use calculateFeeAllocation for new code
 */
export function calculatePlatformFee(basePrice: number, percent: number): number {
  return Math.round(basePrice * percent * 100) / 100;
}

/**
 * Legacy gateway fee calculation (for backward compatibility)
 * @deprecated Use calculateFeeAllocation for new code
 */
export function calculateGatewayFees(basePrice: number): LegacyTicketFeeResult {
  const fixed = GATEWAY_FEES.FIXED;
  const variable = basePrice * GATEWAY_FEES.VARIABLE;
  const subtotal = fixed + variable;
  const iva = subtotal * GATEWAY_FEES.IVA;

  return {
    totalGatewayFee: Math.round(subtotal * 100) / 100,
    iva: Math.round(iva * 100) / 100,
  };
}

/**
 * Legacy menu fee calculation (for backward compatibility)
 * @deprecated Use calculateFeeAllocation for new code
 */
export function calculateMenuFees(
  totalPaid: number,
  paymentMethod: string,
  platformFeeApplied: number
): LegacyMenuFeeResult {
  const platformReceives = calculatePlatformFee(totalPaid, platformFeeApplied);
  const gateway = calculateGatewayFees(totalPaid);

  const clubReceives = totalPaid - platformReceives;

  if (paymentMethod === "wompi") {
    return {
      platformReceives,
      clubReceives,
      gatewayFee: gateway.totalGatewayFee,
      gatewayIVA: gateway.iva,
      retentionFuente: 0,
      retentionICA: 0,
      retentionIVA: 0,
    };
  }

  return {
    platformReceives,
    clubReceives,
    gatewayFee: 0,
    gatewayIVA: 0,
    retentionFuente: null,
    retentionICA: null,
    retentionIVA: null,
  };
}
