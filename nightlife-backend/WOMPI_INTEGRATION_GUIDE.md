# 🎉 Complete Wompi Payment Integration Guide

This guide covers the comprehensive Wompi payment integration for the Nightlife Backend, supporting all major Colombian payment methods.

## 🚀 Features Implemented

### ✅ Supported Payment Methods
1. **Credit/Debit Cards** - Visa, Mastercard, Amex with installments
2. **Nequi** - Mobile wallet payments with push notifications
3. **PSE** - Bank transfers from any Colombian bank
4. **Bancolombia Transfer** - Direct Bancolombia account transfers
5. **Daviplata** - Davivienda mobile wallet with OTP verification (DISABLED)

### ✅ Key Components

#### 1. **Enhanced Wompi Service** (`src/services/wompi.service.ts`)
- Support for all payment method tokenization
- PSE bank listing endpoint
- Async payment URL polling for redirect methods
- Comprehensive error handling and response types

#### 2. **Updated Controllers**
- **Ticket Initiate** (`src/controllers/ticketInitiateWompi.controller.ts`)
- **Menu Initiate** (`src/controllers/menuInitiateWompi.controller.ts`)
- **PSE Controller** (`src/controllers/pseController.ts`)

#### 3. **Configuration** (`src/config/wompi.ts`)
- All payment method constants
- PSE endpoints
- Enhanced status handling

#### 4. **Webhook Handler** (`src/controllers/webhook.controller.ts`)
- Signature verification
- Idempotent transaction updates
- Support for all payment statuses

## 📋 API Endpoints

### Payment Initiation
```
POST /wompi/tickets/initiate
POST /wompi/menu/initiate
```

### Payment Confirmation
```
POST /wompi/tickets/checkout
POST /wompi/menu/checkout
```

### PSE Banks
```
GET /api/pse/banks
```

### Webhooks
```
POST /api/webhook/wompi
```

## 💳 Payment Method Usage

### 1. Credit/Debit Cards
```json
{
  "email": "user@example.com",
  "paymentMethod": "CARD",
  "installments": 1,
  "paymentData": {
    "number": "4242424242424242",
    "cvc": "123",
    "exp_month": "12",
    "exp_year": "29",
    "card_holder": "John Doe"
  }
}
```

### 2. Nequi
```json
{
  "email": "user@example.com",
  "paymentMethod": "NEQUI",
  "paymentData": {
    "phone_number": "3991111111"
  }
}
```

### 3. PSE
```json
{
  "email": "user@example.com",
  "paymentMethod": "PSE",
  "paymentData": {
    "user_type": 0,
    "user_legal_id_type": "CC",
    "user_legal_id": "1234567890",
    "financial_institution_code": "1",
    "payment_description": "Purchase description"
  },
  "customer_data": {
    "phone_number": "3001234567",
    "full_name": "John Doe"
  }
}
```

### 4. Bancolombia Transfer
```json
{
  "email": "user@example.com",
  "paymentMethod": "BANCOLOMBIA_TRANSFER",
  "paymentData": {
    "payment_description": "Purchase description",
    "ecommerce_url": "https://yoursite.com/thank-you"
  }
}
```

### 5. Daviplata (DISABLED)
```json
{
  "email": "user@example.com",
  "paymentMethod": "DAVIPLATA",
  "paymentData": {
    "user_legal_id_type": "CC",
    "user_legal_id": "1234567890",
    "payment_description": "Purchase description"
  }
}
```

## 🧪 Sandbox Testing

### Test Data
- **Cards:** `4242424242424242` (APPROVED), `4111111111111111` (DECLINED)
- **Nequi:** `3991111111` (APPROVED), `3992222222` (DECLINED)
- **PSE:** Bank code `"1"` (APPROVED), `"2"` (DECLINED)
- **Daviplata OTP:** `574829` (APPROVED), `932015` (DECLINED)
- **Bancolombia:** Choose outcome on redirect page

### Test Interface
Use `/public/test-wompi-complete.html` for comprehensive testing of all payment methods.

## 🔄 Payment Flows

### Immediate Response (Cards, Nequi)
1. Create transaction
2. Get immediate or PENDING status
3. For cards: possible instant approval/decline
4. For Nequi: user gets push notification
5. Poll or use webhooks for final status

### Redirect Flow (PSE, Bancolombia)
1. Create transaction
2. Poll for `async_payment_url`
3. Redirect user to bank/financial institution
4. User returns to your `redirect_url`
5. Poll transaction status or use webhooks

### OTP Flow (Daviplata) - DISABLED
1. Create transaction
2. Get OTP URL from response
3. User enters OTP code
4. Transaction completes
5. Use webhooks for final confirmation

## 🔒 Security Features

### Acceptance Tokens
- Automatic fetching of acceptance tokens
- Privacy policy and personal data processing consent
- Required for all transactions per Colombian law

### Webhook Verification
- SHA-256 signature verification
- Timing-safe comparison
- Idempotent transaction updates

### Error Handling
- Comprehensive validation
- Graceful degradation
- Detailed error responses

## 🚀 Environment Setup

### Required Environment Variables
```env
# Sandbox
WOMPI_PRIVATE_KEY_SANDBOX=prv_test_xxxxx
WOMPI_PUBLIC_KEY_SANDBOX=pub_test_xxxxx
WOMPI_INTEGRITY_KEY_SANDBOX=xxxxx
WOMPI_EVENT_KEY_SANDBOX=xxxxx

# Production
WOMPI_PRIVATE_KEY_PRODUCTION=prv_prod_xxxxx
WOMPI_PUBLIC_KEY_PRODUCTION=pub_prod_xxxxx
WOMPI_INTEGRITY_KEY_PRODUCTION=xxxxx
WOMPI_EVENT_KEY_PRODUCTION=xxxxx

# Environment
WOMPI_ENVIRONMENT=sandbox
```

## 📱 Frontend Integration

### Response Handling
```javascript
// Handle different response types
if (response.requiresRedirect) {
  // Redirect to bank (PSE, Bancolombia)
  window.location.href = response.redirectUrl;
} else if (response.requiresOTP) {
          // Show OTP interface (Daviplata) - DISABLED
  showOTPModal(response.otpUrl);
} else if (response.status === 'PENDING') {
  // Poll for status (Nequi, Cards with 3DS)
  pollTransactionStatus(response.transactionId);
}
```

### Status Polling
```javascript
async function pollTransactionStatus(transactionId) {
  const response = await fetch('/wompi/tickets/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactionId })
  });
  
  const data = await response.json();
  
  if (data.success || data.status === 'APPROVED') {
    // Payment successful
    redirectToSuccessPage();
  } else if (data.status === 'DECLINED') {
    // Payment failed
    showError(data.error);
  }
}
```

## 🎯 Best Practices

1. **Always use HTTPS** in production
2. **Validate payment data** on the frontend before sending
3. **Handle all possible statuses** (PENDING, APPROVED, DECLINED, ERROR, VOIDED)
4. **Implement proper error handling** for network failures
5. **Use webhooks** as the source of truth for final payment status
6. **Store transaction references** for audit trails
7. **Implement proper logging** for debugging and monitoring

## 🔧 Troubleshooting

### Common Issues

1. **Invalid Signature Errors**
   - Check integrity key configuration
   - Verify signature generation logic
   - Ensure correct environment (sandbox vs production)

2. **Transaction Not Found**
   - Verify transaction ID format
   - Check if transaction expired (30-minute TTL)
   - Ensure proper data storage

3. **Webhook Not Receiving Events**
   - Verify webhook URL is accessible
   - Check signature verification logic
   - Ensure 200 response is returned quickly

4. **Async URL Not Available**
   - Implement polling with timeout
   - Check if payment method supports async URLs
   - Verify transaction was created successfully

## 📊 Transaction Lifecycle

```mermaid
graph TD
    A[User Initiates Payment] --> B[Create Transaction]
    B --> C{Payment Method}
    
    C -->|Card/Nequi| D[Immediate Response]
    C -->|PSE/Bancolombia| E[Poll for Async URL]
            C -->|Daviplata (DISABLED)| F[Get OTP URL]
    
    E --> G[Redirect to Bank]
    F --> H[User Enters OTP]
    
    D --> I[Check Status]
    G --> J[User Returns]
    H --> I
    J --> I
    
    I --> K{Final Status}
    K -->|APPROVED| L[Success]
    K -->|DECLINED| M[Failed]
    K -->|PENDING| N[Continue Polling]
    
    N --> I
```

## 🎉 Conclusion

This implementation provides a complete, production-ready Wompi integration supporting all major Colombian payment methods. The system is designed to be secure, scalable, and user-friendly, with comprehensive error handling and testing capabilities.

For questions or issues, refer to the [Wompi documentation](https://docs.wompi.co/) or the sandbox test interface included in this project.
