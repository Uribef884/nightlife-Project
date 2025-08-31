# Cart Locking Solution for Payment Race Condition Prevention

## Problem Description

**Current behavior (bug):** While the payment/checkout request is being processed, the cart is still "open" and users can keep adding items. This creates a race condition where:

1. The `PurchaseTransaction` is calculated from an old snapshot of the cart
2. The database still allows inserts/updates to the cart
3. This could cause:
   - Mismatched totals between cart and transaction
   - Invalid QR codes
   - Customer disputes
   - Data integrity issues

## Solution Implemented

### 1. Cart Locking Utility (`src/utils/cartLock.ts`)

Created a comprehensive cart locking mechanism that:

- **Locks carts** during payment processing to prevent modifications
- **Validates cart contents** haven't changed since lock acquisition
- **Manages lock timeouts** (10 minutes) with automatic cleanup
- **Supports both ticket and menu carts**
- **Provides detailed logging** for debugging

#### Key Functions:

```typescript
// Lock cart before payment processing
lockCart(userId, sessionId, transactionId, cartType)

// Unlock cart after successful checkout
unlockCart(userId, sessionId)

// Check if cart is currently locked
isCartLocked(userId, sessionId)

// Lock and validate cart in one operation
lockAndValidateCart(userId, sessionId, transactionId, cartType)

// Update transaction ID for existing lock
updateCartLockTransactionId(userId, sessionId, newTransactionId)
```

### 2. Cart Controllers Updated

#### Ticket Cart Controller (`src/controllers/ticketCart.controller.ts`)
- Added cart lock checks to `addToCart`, `updateCartItem`, `removeCartItem`
- Returns HTTP 423 (Locked) when cart is being processed

#### Menu Cart Controller (`src/controllers/menuCart.controller.ts`)
- Added cart lock checks to `addToMenuCart`, `updateMenuCartItem`, `removeMenuCartItem`
- Returns HTTP 423 (Locked) when cart is being processed

### 3. Checkout Controllers Updated

#### Ticket Checkout (`src/controllers/ticketCheckout.controller.ts`)
- Unlocks cart after successful checkout completion
- Ensures cart is always unlocked even if errors occur

#### Wompi Ticket Checkout (`src/controllers/ticketCheckoutWompi.controller.ts`)
- Unlocks cart after successful Wompi checkout completion
- Handles both automatic and manual checkout flows

#### Menu Checkout (`src/controllers/menuCheckout.controller.ts`)
- Unlocks cart after successful menu checkout completion

### 4. Checkout Initiation Controllers Updated

#### Ticket Initiation (`src/controllers/ticketInitiateWompi.controller.ts`)
- Locks cart before creating Wompi transaction
- Updates lock with real transaction ID after creation
- Prevents cart modifications during payment processing

#### Menu Initiation (`src/controllers/menuInitiate.controller.ts`)
- Locks cart before mock checkout initiation
- Ensures cart consistency during payment flow

## How It Works

### 1. Payment Initiation Flow
```
User initiates checkout → Cart locked → Payment processing → Cart unlocked
```

### 2. Cart Locking Process
```
1. User clicks "Pay" or initiates checkout
2. Cart is locked with temporary transaction ID
3. Payment gateway transaction created
4. Cart lock updated with real transaction ID
5. Payment processing continues
6. Cart remains locked until checkout completes
7. Cart unlocked after successful checkout
```

### 3. Cart Modification Prevention
```
User tries to add/update/remove items → Cart lock check → HTTP 423 if locked
```

## Error Handling

### HTTP 423 (Locked) Response
```json
{
  "error": "Cart is currently being processed. Please wait for your payment to complete before adding more items."
}
```

### Automatic Lock Cleanup
- Expired locks (10+ minutes) are automatically cleaned up
- Background cleanup runs every 5 minutes
- Prevents permanent cart locks from failed transactions

## Benefits

1. **Prevents Race Conditions**: Cart cannot be modified during payment processing
2. **Ensures Data Consistency**: Transaction totals always match cart contents
3. **Improves User Experience**: Clear error messages when cart is locked
4. **Maintains Security**: Prevents cart manipulation during payment
5. **Automatic Cleanup**: Expired locks don't permanently block users
6. **Comprehensive Coverage**: Works for both ticket and menu carts

## Implementation Notes

### Production Considerations
- **Current**: In-memory lock storage (suitable for single-server deployments)
- **Production**: Should use Redis or similar distributed lock mechanism
- **Scaling**: Multiple server instances would need shared lock storage

### Lock Timeout
- **Default**: 10 minutes (configurable)
- **Rationale**: Covers typical payment processing time + buffer
- **Cleanup**: Automatic cleanup every 5 minutes

### Transaction ID Management
- **Temporary IDs**: Used initially for cart locking
- **Real IDs**: Updated after payment gateway transaction creation
- **Tracking**: Full audit trail of lock acquisition and release

## Testing

### Test Scenarios
1. **Normal Flow**: Cart locks during payment, unlocks after completion
2. **Concurrent Access**: Multiple requests blocked when cart is locked
3. **Timeout Handling**: Expired locks automatically cleaned up
4. **Error Recovery**: Cart unlocks even if checkout fails
5. **Cross-Cart Prevention**: Ticket cart blocks menu cart and vice versa

### Manual Testing
```bash
# 1. Add items to cart
# 2. Initiate checkout (cart becomes locked)
# 3. Try to add more items (should get HTTP 423)
# 4. Complete payment (cart unlocks)
# 5. Verify cart can be modified again
```

## Future Enhancements

1. **Redis Integration**: Distributed lock storage for multi-server deployments
2. **Lock Analytics**: Track lock duration and frequency
3. **User Notifications**: Real-time updates when cart is locked/unlocked
4. **Lock History**: Audit trail of all cart lock operations
5. **Configurable Timeouts**: Different timeouts for different payment methods

## Conclusion

This cart locking solution effectively prevents the race condition described in the bug report. By locking carts during payment processing, we ensure:

- **Data integrity** between cart contents and transaction records
- **Consistent user experience** with clear error messages
- **Secure payment flow** without cart manipulation
- **Automatic cleanup** of abandoned or failed transactions

The solution is comprehensive, covering both ticket and menu carts, and integrates seamlessly with the existing checkout flow while maintaining backward compatibility.
