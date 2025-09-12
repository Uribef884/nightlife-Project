// DEPRECATED - LEGACY CONTROLLER - USE UNIFIED CHECKOUT INSTEAD
// This controller used the old 6-table structure and has been replaced by the unified checkout system
// The unified checkout system uses only 3 tables: UnifiedPurchaseTransaction, TicketPurchase, MenuPurchase

// To use the new system, use the unified checkout endpoints:
// - POST /api/unified-checkout/initiate
// - POST /api/unified-checkout/confirm  
// - POST /api/unified-checkout/start-automatic

export const confirmWompiTicketCheckout = () => {
  throw new Error('This endpoint has been deprecated. Use the unified checkout system instead.');
};

export const checkWompiTransactionStatus = () => {
  throw new Error('This endpoint has been deprecated. Use the unified checkout system instead.');
};
