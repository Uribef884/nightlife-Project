# Nightlife Project - Dynamic Pricing & Cart Rules Documentation

## 📋 Table of Contents
1. [Dynamic Pricing Rules](#dynamic-pricing-rules)
2. [Unified Cart Rules](#unified-cart-rules)
3. [Date Binding Rules](#date-binding-rules)
4. [Event Coexistence Rules](#event-coexistence-rules)
5. [Validation Rules](#validation-rules)
6. [Commission & Fee Structure](#commission--fee-structure)

---

## 🎯 Dynamic Pricing Rules

### **General Dynamic Pricing Constants**
```typescript
DYNAMIC_PRICING = {
  CLOSED_DAY: 0.7,    // 30% off if club is closed
  EARLY: 0.9,         // 10% off if >180min before open
  
  EVENT: {
    HOURS_48_PLUS: 0.7,   // 30% discount for 48+ hours away
    HOURS_24_48: 1.0,     // Base price for 24-48 hours away
    HOURS_LESS_24: 1.2,   // 20% surplus for less than 24 hours
  }
}
```

### **1. Event Tickets Dynamic Pricing**
**Time Windows (based on hours until event start):**
- **48+ hours before event**: 30% discount (0.7x multiplier)
- **24-48 hours before event**: Base price (1.0x multiplier)
- **<24 hours before event**: 20% surcharge (1.2x multiplier)
- **After event starts**: Base price (1.0x multiplier)

**Special Rules:**
- Uses event's `openHours` to determine actual event start time
- Event tickets bypass club `openDays` validation
- Grace period after event start (configurable)

### **2. General/Free Tickets Dynamic Pricing**
**Time Windows (based on minutes until club opens):**
- **3+ hours before club opens**: 30% discount (0.7x multiplier)
- **2-3 hours before club opens**: 10% discount (0.9x multiplier)
- **<2 hours before club opens**: Base price (1.0x multiplier)
- **During club open hours**: Base price (1.0x multiplier)
- **Club closed days**: 30% discount (0.7x multiplier)

**Special Rules:**
- Must respect club `openDays` configuration
- Uses club's `openHours` for time calculations
- Different day and closed: 30% discount

### **3. Menu Items Dynamic Pricing**

#### **3.1 Menu Items on Event Dates**
**Time Windows (based on hours until event start):**
- **48+ hours before event**: 30% discount (0.7x multiplier)
- **24-48 hours before event**: Base price (1.0x multiplier)
- **<24 hours before event**: Base price (1.0x multiplier)

**Special Rules:**
- **NEVER applies surcharges** - menu items "floor" at base price
- Uses event's `openHours` for event start time calculation
- Event dates bypass club `openDays` validation

#### **3.2 Menu Items on Normal Days**
**Time Windows (based on club operating schedule):**
- **Club Closed Days**: 30% discount (0.7x multiplier)
- **Club Open Days, 3+ hours before opening**: 30% discount (0.7x multiplier)
- **Club Open Days, <3 hours before opening**: 10% discount (0.9x multiplier)
- **During Club Open Hours**: Base price (1.0x multiplier)
- **After hours (club closed for the day)**: 30% discount (0.7x multiplier)

**Special Rules:**
- Must respect club `openDays` configuration
- Uses club's `openHours` for time calculations
- No hours defined for day = treat as closed (30% discount)

---

## 🛒 Unified Cart Rules

### **Core Cart Consistency Rules**

#### **Rule 1: Same Club Constraint**
- **ALL items in cart must be from the same club**
- Cannot mix items from different clubs
- Error: "All items in cart must be from the same club"

#### **Rule 2: Same Date Constraint**
- **ALL items (tickets + menu) must be for the same date**
- Exception: Event tickets from the same event can have different dates (multi-day events)
- Error: "All items in cart must be for the same date. Current cart has items for {date1}, but you're trying to add an item for {date2}"

### **Date Binding Rules**

#### **Date Format & Validation**
- **Format**: UTC, YYYY-MM-DD (e.g., "2025-09-14")
- **Range**: Today to +21 days (3-week rule)
- **Past dates**: Invalid, throws error
- **Required**: Every menu item must include a date

#### **Date Setting Logic**
- If cart is empty: First item sets the cart date
- If cart has items: New items must match existing cart date
- Event tickets lock the cart date (unchanged behavior)

### **Event Coexistence Rules**

#### **Event Ticket Priority**
- **Event tickets cannot coexist** with other ticket categories
- **Event tickets can coexist** with menu items for the same date
- **General/Free tickets can coexist** with menu items for the same date
- **General/Free tickets can coexist** among themselves

#### **Menu + Event Coexistence**
- **On event dates**: Menu items may be purchased without requiring an event ticket
- **Walk-in purchases**: Allowed for event dates (bottle service, etc.)
- **Event ticket present**: Locks cart date, menu items must match
- **No event ticket**: Users can still add menu items for event date

### **Availability Rules**

#### **Menu Items**
- **Advance window**: No separate window beyond 3-week rule
- **Stock**: Item/variant must be active and in stock (if tracked)
- **Quantity**: Must respect `maxPerPerson` limits

#### **Tickets**
- **Event tickets**: Must be active and not sold out
- **General tickets**: Must be active and available
- **Quantity**: Must respect ticket limits

### **Cart Merge Rules**
- **Identical items**: `(menuItemId + variantId + date)` → increment quantity
- **Different items**: Create new line item
- **Quantity bounds**: Respect `maxPerPerson` limits

---

## 🔒 Validation Rules

### **Authentication & Ownership**
- **Required**: `userId` OR `sessionId`
- **Cart ownership**: Enforced throughout
- **Cross-user guards**: Prevent unauthorized access

### **Date Validation**
- **Format**: YYYY-MM-DD string
- **Range**: Not in past, ≤21 days ahead
- **Timezone**: UTC for consistent validation

### **Quantity Validation**
- **Minimum**: Quantity > 0
- **Maximum**: ≤ `maxPerPerson` (item or variant level)
- **Integer**: Must be whole numbers

### **Availability Validation**
- **Active status**: Item/variant must be active
- **Stock check**: If stock is tracked, must be available
- **Club validation**: Must respect club operating rules

### **Open Days Validation with Event Bypass**
```typescript
// Check if there's an event on this date - if so, bypass openDays validation
const event = await eventRepo.findOne({
  where: {
    clubId: menuItem.clubId,
    availableDate: new Date(`${date}T00:00:00`),
    isActive: true
  }
});

// Only check openDays if there's no event (events bypass openDays validation)
if (!event) {
  const selectedDay = new Date(`${date}T12:00:00`).toLocaleString("en-US", { weekday: "long" });
  if (!(menuItem.club.openDays || []).includes(selectedDay)) {
    throw new Error(`This club is not open on ${selectedDay}`);
  }
}
```

---

## 💰 Commission & Fee Structure

### **Platform Commission Rates**
```typescript
PLATFORM_FEES = {
  TICKET: {
    REGULAR: 0.05,    // 5% for regular tickets
    EVENT: 0.10,      // 10% for event tickets
  },
  MENU: {
    ALL_ITEMS: 0.025,  // 2.5% for all menu items
  }
}
```

### **Gateway/Payment Provider Fees (Wompi)**
```typescript
GATEWAY_FEES = {
  FIXED: 700,         // Fixed fee in COP
  VARIABLE: 0.0265,   // Variable fee 2.65% of the base price
  IVA: 0.19,          // IVA 19% on the subtotal
}
```

---

## 🚫 Error Messages

### **Cart Consistency Errors**
- `"All items in cart must be from the same club"`
- `"All items in cart must be for the same date. Current cart has items for {date1}, but you're trying to add an item for {date2}. Please clear your cart or select the same date."`
- `"This club is not open on {dayName}"`

### **Validation Errors**
- `"Cannot select a past date"`
- `"Quantity must be greater than 0"`
- `"Ticket not found or inactive"`
- `"Missing or invalid token"`

### **Event Coexistence Errors**
- `"Event tickets cannot be mixed with other ticket types"`
- `"Event tickets from different events cannot be mixed"`

---

## 📱 QR Code & Redemption Rules

### **Menu-Only Transactions**
- **Validity**: QR valid on selected date until 1:00 AM next day
- **Usage**: Single-use, club-scoped
- **Validation**: Waiter validation remains club-scoped

### **Menu Attached to Tickets**
- **Validity**: Honor ticket/event date window
- **Usage**: Single-use, club-scoped
- **Validation**: Waiter validation remains club-scoped

### **QR Validation Logic**
- **Event tickets**: Valid on event date regardless of club operating days
- **Event menu**: If there's an event today, allow menu redemption regardless of club open days
- **Normal menu**: Must respect club operating days and hours

---

## 🔄 Locking & Checkout Behavior

### **Cart Locking**
- **Payment lock**: Applied during checkout process
- **Empty cart**: Smart unlock after successful checkout
- **Ownership**: Cross-user guards remain unchanged

### **Checkout Process**
1. **Lock cart** for payment processing
2. **Validate** all items and consistency rules
3. **Calculate** dynamic pricing and fees
4. **Process** payment through Wompi
5. **Create** purchase transactions
6. **Clear cart** after successful checkout
7. **Unlock cart** for future use

---

## 📊 Examples

### **Valid Cart Combinations**
- ✅ 2 General tickets (Oct 4, Club X) + 1 Bottle (Oct 4, Club X)
- ✅ 3 Bottles (Oct 11, Club X), no tickets
- ✅ 1 Event ticket (Oct 15, Club X) + 2 Bottles (Oct 15, Club X)

### **Invalid Cart Combinations**
- ❌ Bottle (Oct 4) + Ticket (Oct 5) - Different dates
- ❌ Bottle (Oct 4, Club X) + Ticket (Oct 4, Club Y) - Different clubs
- ❌ Event ticket (Oct 4) + General ticket (Oct 4) - Mixed ticket types

### **Dynamic Pricing Examples**
- **Event ticket 48h away**: Base price × 0.7 (30% discount)
- **Menu item 48h before event**: Base price × 0.7 (30% discount)
- **Menu item <24h before event**: Base price × 1.0 (no surcharge)
- **Menu item on closed day**: Base price × 0.7 (30% discount)

---

*Last Updated: January 2025*
*Version: 2.0*
