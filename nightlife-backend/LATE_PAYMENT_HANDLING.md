# Late Payment Handling Guide

## The Problem: 5-30 Minute Window

**Critical Issue**: If a user completes payment between 5-30 minutes (after your polling stops but before Wompi expires the transaction), you could have a **completed payment that you never processed**.

### Timeline:
```
0 min:  User starts payment → PENDING
5 min:  Your polling stops → TIMEOUT (user sees timeout page)
6-30 min: User completes payment → APPROVED (Wompi webhook)
Result: User paid but you never processed the order!
```

## The Solution: Webhook + Late Processing

### 1. Enable Webhooks (Required)

**In Wompi Dashboard:**
- Set webhook URL: `https://your-domain.com/api/webhook/wompi`
- Add event secret to your `.env`:
  ```env
  WOMPI_EVENT_KEY_SANDBOX=your_sandbox_event_secret
  WOMPI_EVENT_KEY_PRODUCTION=your_production_event_secret
  ```

### 2. Late Processing Logic (Already Added)

The webhook now detects when a transaction becomes APPROVED after being marked as TIMEOUT:

```typescript
// Detects late APPROVED transactions
if (status === "APPROVED" && existing.paymentStatus === "TIMEOUT") {
  // Process the order even though polling stopped
  await processWompiSuccessfulUnifiedCheckout(...)
}
```

## How It Works Now

### Scenario 1: Normal Flow (0-5 minutes)
```
1. User pays → APPROVED
2. Polling detects → Process order
3. User gets success page
```

### Scenario 2: Late Payment (5-30 minutes)
```
1. User starts payment → PENDING
2. 5 minutes → Polling stops → TIMEOUT
3. User sees timeout page
4. User completes payment → APPROVED
5. Wompi webhook → Late processing → Order completed
6. User gets email confirmation
```

### Scenario 3: True Timeout (30+ minutes)
```
1. User starts payment → PENDING
2. 5 minutes → Polling stops → TIMEOUT
3. User sees timeout page
4. 30 minutes → Wompi expires transaction
5. No webhook → No order processed
```

## Benefits of This Approach

✅ **No Lost Orders**: Late payments are automatically processed
✅ **No Double Charging**: Idempotency prevents duplicate processing
✅ **User Experience**: Users get their orders even if they complete payment late
✅ **Reliability**: Webhooks provide backup to polling

## Monitoring

### Log Messages to Watch:
- `[WOMPI] 🚨 Late APPROVED transaction detected!` - Late payment caught
- `[WOMPI] ✅ Late APPROVED transaction processed successfully` - Order processed
- `[WOMPI] ❌ Failed to process late APPROVED transaction` - Error processing

### Database Queries:
```sql
-- Find transactions that were processed late
SELECT * FROM unified_purchase_transactions 
WHERE payment_status = 'APPROVED' 
AND created_at < updated_at - INTERVAL '5 minutes';

-- Find timeout transactions that might need manual review
SELECT * FROM unified_purchase_transactions 
WHERE payment_status = 'TIMEOUT' 
AND created_at < NOW() - INTERVAL '30 minutes';
```

## Testing

### Test Late Payment Scenario:
1. Start a payment
2. Wait 6 minutes (after polling stops)
3. Complete payment on Wompi side
4. Check logs for "Late APPROVED transaction detected"
5. Verify order is processed and user gets email

### Test Webhook Endpoint:
```bash
curl -X GET https://your-domain.com/api/webhook/wompi/ping
# Should return: {"ok": true, "path": "/api/webhook/wompi/ping", "method": "GET"}
```

## Fallback: Manual Processing

If webhooks fail, you can manually process late payments:

```typescript
// Check for late APPROVED transactions
const lateTransactions = await repo.find({
  where: {
    paymentStatus: 'APPROVED',
    paymentProviderTransactionId: Not(IsNull())
  }
});

// Process each one
for (const transaction of lateTransactions) {
  await processWompiSuccessfulUnifiedCheckout({
    userId: transaction.userId,
    sessionId: transaction.sessionId,
    email: transaction.buyerEmail,
    transactionId: transaction.id,
    cartItems: []
  });
}
```

## Summary

With this implementation:
- **No lost orders** from late payments
- **No double charging** from duplicate processing
- **Reliable webhook backup** to polling
- **Automatic late processing** without manual intervention

The 5-30 minute window is now fully covered!
