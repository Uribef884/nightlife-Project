/**
 * Frontend constants and configuration
 * 
 * Note: Some values like grace period should ideally come from the backend
 * For now, they are hardcoded here but should be kept in sync with backend values
 */

// Event Grace Period Configuration
// This should match EVENT_GRACE_PERIOD.HOURS in nightlife-backend/src/config/fees.ts
export const EVENT_GRACE_PERIOD_HOURS = 3;

// Grace period pricing multiplier (30% surcharge)
// This should match EVENT_GRACE_PERIOD.MULTIPLIER in nightlife-backend/src/config/fees.ts
export const EVENT_GRACE_PERIOD_MULTIPLIER = 1.3;
