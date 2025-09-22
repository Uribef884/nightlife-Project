# Wompi Webhook Setup Guide

## Overview
This guide explains how to properly configure Wompi webhooks to prevent double charging and ensure reliable payment processing.

## 1. Webhook URL Configuration

### In Wompi Commerce Dashboard:
1. Go to your Wompi Commerce Dashboard
2. Navigate to "Configuración" → "Eventos"
3. Set your webhook URLs:
   - **Sandbox**: `https://your-domain.com/api/webhook/wompi`
   - **Production**: `https://your-domain.com/api/webhook/wompi`

## 2. Environment Variables

Add these to your `.env` file:

```env
# Wompi Event Secrets (different from private keys)
WOMPI_EVENT_KEY_SANDBOX=your_sandbox_event_secret_here
WOMPI_EVENT_KEY_PRODUCTION=your_production_event_secret_here

# Optional: Enable strict mode for better error handling
WOMPI_STRICT=false
```

## 3. How It Prevents Double Charging

### Idempotency Protection:
- **Transaction ID Check**: Each webhook includes a unique Wompi transaction ID
- **Status Verification**: Only processes if the status has actually changed
- **Database Tracking**: Stores the Wompi transaction ID to prevent reprocessing

### Webhook Retry Logic:
According to Wompi documentation:
- **First retry**: 30 minutes after initial failure
- **Second retry**: 3 hours after initial failure  
- **Final retry**: 24 hours after initial failure
- **Maximum retries**: 3 attempts total

## 4. Security Features

### Checksum Validation:
- Validates webhook authenticity using SHA256 checksum
- Uses timing-safe comparison to prevent timing attacks
- Validates against your Event Secret (not private key)

### Event Structure:
```json
{
  "event": "transaction.updated",
  "data": {
    "transaction": {
      "id": "wompi-transaction-id",
      "status": "APPROVED",
      "amount_in_cents": 100000,
      "reference": "unified_your-transaction-id"
    }
  },
  "sent_at": "2023-12-01T10:00:00.000Z"
}
```

## 5. Testing Your Webhook

### Test Endpoint:
```bash
# Test webhook connectivity
curl -X GET https://your-domain.com/api/webhook/wompi/ping
```

### Expected Response:
```json
{
  "ok": true,
  "path": "/api/webhook/wompi/ping",
  "method": "GET"
}
```

## 6. Monitoring Webhook Health

### Log Messages to Watch:
- `[WOMPI] Processed` - Successful webhook processing
- `[WOMPI] Invalid checksum` - Security validation failed
- `[WOMPI] Unified transaction already up-to-date` - Idempotency working
- `[WOMPI] Unified transaction updated` - Status change processed

### Error Handling:
- **Invalid webhooks**: Return 200 (acknowledged) to prevent retries
- **Valid webhooks**: Process and return 200
- **Database errors**: Log and return 200 (to prevent infinite retries)

## 7. Production Checklist

- [ ] Webhook URL configured in Wompi Dashboard
- [ ] Event secrets added to environment variables
- [ ] HTTPS enabled for webhook endpoint
- [ ] Database transactions are idempotent
- [ ] Logging configured for monitoring
- [ ] Error handling tested
- [ ] Webhook endpoint accessible from Wompi servers

## 8. Common Issues

### Webhook Not Receiving Events:
1. Check webhook URL is accessible from internet
2. Verify HTTPS is enabled
3. Check firewall/security group settings
4. Ensure webhook returns 200 status

### Double Charging Prevention:
1. Verify idempotency logic is working
2. Check database constraints on transaction IDs
3. Monitor logs for "already up-to-date" messages
4. Test with duplicate webhook calls

### Security Concerns:
1. Never log the Event Secret
2. Use timing-safe comparison for checksums
3. Validate all webhook data before processing
4. Implement rate limiting if needed

## 9. Webhook Events Handled

| Event Type | Description | Action |
|------------|-------------|---------|
| `transaction.updated` | Transaction status changed | Update payment status, broadcast SSE |
| `nequi_token.updated` | Nequi token status changed | Update token status |
| `bancolombia_transfer_token.updated` | Bancolombia token status changed | Update token status |

## 10. Integration with Your App

Your current implementation already handles:
- ✅ Checksum validation
- ✅ Idempotency protection  
- ✅ Database updates
- ✅ SSE broadcasting
- ✅ Error handling
- ✅ Logging

The webhook is already integrated with your unified checkout system and will automatically update transaction statuses when Wompi sends events.
