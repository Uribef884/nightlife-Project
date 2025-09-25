# Webhook Testing Guide

## 🔍 **How to Verify Webhooks Are Working**

### **1. Basic Connectivity Test**

First, ensure your backend is running and test the webhook endpoint:

```bash
# Test webhook ping endpoint
curl -X GET http://localhost:4000/api/webhook/wompi/ping

# Expected response:
# {"ok": true, "path": "/api/webhook/wompi/ping", "method": "GET"}
```

### **2. Webhook URL Configuration**

**In Wompi Dashboard:**
1. Go to your Wompi Commerce Dashboard
2. Navigate to "Configuración" → "Eventos"
3. Set webhook URLs:
   - **Sandbox**: `https://your-domain.com/api/webhook/wompi`
   - **Production**: `https://your-domain.com/api/webhook/wompi`

**Environment Variables:**
```env
# Add to your .env file
WOMPI_EVENT_KEY_SANDBOX=your_sandbox_event_secret
WOMPI_EVENT_KEY_PRODUCTION=your_production_event_secret
```

### **3. Test Webhook with Mock Data**

Create a test script to simulate Wompi webhook calls:

```typescript
// test-webhook.ts
import axios from 'axios';

const webhookUrl = 'https://affa1a8a1187.ngrok-free.app/api/webhook/wompi';

const mockWebhookData = {
  event: "transaction.updated",
  data: {
    transaction: {
      id: "test-wompi-tx-123",
      amount_in_cents: 100000,
      reference: "unified_test-transaction-456",
      customer_email: "test@example.com",
      currency: "COP",
      payment_method_type: "CARD",
      status: "APPROVED"
    }
  },
  sent_at: new Date().toISOString(),
  signature: {
    checksum: "mock-checksum",
    properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"]
  },
  timestamp: Math.floor(Date.now() / 1000)
};

async function testWebhook() {
  try {
    const response = await axios.post(webhookUrl, mockWebhookData);
    console.log('Webhook test response:', response.data);
  } catch (error) {
    console.error('Webhook test failed:', error.response?.data || error.message);
  }
}

testWebhook();
```

### **4. Monitor Webhook Logs**

Watch your backend logs for webhook activity:

```bash
# In your backend terminal, look for these log messages:
[WOMPI] Processed { txId: '...', status: 'APPROVED' }
[WOMPI] 🚨 Late APPROVED transaction detected!
[WOMPI] ✅ Late APPROVED transaction processed successfully
[WOMPI] Invalid checksum { txId: '...' }
```

### **5. Test Late Payment Scenario**

**Simulate the 5-30 minute window:**

1. **Start a payment** (create a transaction)
2. **Wait 6 minutes** (after your polling stops)
3. **Manually trigger webhook** with APPROVED status
4. **Check logs** for "Late APPROVED transaction detected"
5. **Verify order processing**

### **6. Database Verification**

Check your database for webhook processing:

```sql
-- Check for processed transactions
SELECT 
  id,
  payment_status,
  payment_provider_transaction_id,
  created_at,
  updated_at
FROM unified_purchase_transactions 
WHERE payment_provider_transaction_id IS NOT NULL
ORDER BY updated_at DESC;

-- Check for late processed transactions
SELECT 
  id,
  payment_status,
  created_at,
  updated_at,
  (updated_at - created_at) as processing_time
FROM unified_purchase_transactions 
WHERE payment_status = 'APPROVED' 
AND (updated_at - created_at) > INTERVAL '5 minutes';
```

### **7. Webhook Health Check**

Create a health check endpoint:

```typescript
// Add to your webhook controller
export const webhookHealth = (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    webhookEndpoint: '/api/webhook/wompi',
    pingEndpoint: '/api/webhook/wompi/ping'
  });
};
```

### **8. Production Testing**

**Use Wompi's Test Mode:**
1. Ensure you're in sandbox mode
2. Use test card numbers from Wompi documentation
3. Complete payments and monitor webhook delivery
4. Check Wompi dashboard for webhook delivery status

### **9. Common Issues & Solutions**

**Issue: Webhook not receiving events**
- ✅ Check webhook URL is accessible from internet
- ✅ Verify HTTPS is enabled
- ✅ Check firewall/security group settings
- ✅ Ensure webhook returns 200 status

**Issue: Invalid checksum errors**
- ✅ Verify EVENT_KEY is correct
- ✅ Check signature calculation logic
- ✅ Ensure properties array matches Wompi's format

**Issue: Late payments not processed**
- ✅ Check webhook is enabled
- ✅ Verify late processing logic is working
- ✅ Check database for TIMEOUT → APPROVED transitions

### **10. Monitoring & Alerts**

**Set up monitoring for:**
- Webhook response times
- Failed webhook deliveries
- Late payment processing
- Database transaction status changes

**Key metrics to track:**
- Webhook success rate
- Late payment detection rate
- Order processing completion rate
- Error rates by type

## 🚀 **Quick Test Checklist**

- [ ] Backend is running on port 4000
- [ ] Webhook ping endpoint responds with 200
- [ ] Wompi dashboard has correct webhook URL
- [ ] EVENT_KEY environment variables are set
- [ ] Webhook logs show successful processing
- [ ] Late payment scenario works correctly
- [ ] Database shows proper status updates

## 📊 **Expected Log Output**

**Successful webhook:**
```
[WOMPI] Processed { txId: 'wompi-123', status: 'APPROVED', strict: false }
```

**Late payment detected:**
```
[WOMPI] 🚨 Late APPROVED transaction detected! Processing order... { transactionId: 'unified-456', wompiTxId: 'wompi-123' }
[WOMPI] ✅ Late APPROVED transaction processed successfully { transactionId: 'unified-456' }
```

**Invalid webhook:**
```
[WOMPI] Invalid checksum { txId: 'wompi-123' }
```

With this guide, you can thoroughly test and verify that your webhook system is working correctly!
