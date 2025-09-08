/**
 * @deprecated This file is deprecated. Use feeAllocation.ts for all fee calculations.
 * This file will be removed in a future version.
 * 
 * For new code, use:
 * - calculateFeeAllocation() for unified cart scenarios
 * - calculatePlatformFee() and calculateGatewayFees() from feeAllocation.ts for legacy compatibility
 */

import { GATEWAY_FEES } from "../config/fees";

/**
 * @deprecated Use calculatePlatformFee from feeAllocation.ts instead
 */
export function calculatePlatformFee(basePrice: number, percent: number): number {
  return Math.round(basePrice * percent * 100) / 100;
}

/**
 * @deprecated Use calculateGatewayFees from feeAllocation.ts instead
 */
export function calculateGatewayFees(basePrice: number): {
  totalGatewayFee: number;
  iva: number;
} {
  const fixed = GATEWAY_FEES.FIXED;
  const variable = basePrice * GATEWAY_FEES.VARIABLE;
  const subtotal = fixed + variable;
  const iva = subtotal * GATEWAY_FEES.IVA;

  return {
    totalGatewayFee: Math.round(subtotal * 100) / 100,
    iva: Math.round(iva * 100) / 100,
  };
}