# Database Maintenance Scripts

This directory contains maintenance scripts for the Nightlife backend database.

## Available Scripts

### 1. `clearOldCarts.ts` - Cart Cleanup Script

Clears entire carts from the database when any item in the cart is older than the specified threshold. This prevents storage bloat and ensures users always work with current pricing.

**Usage:**
```bash
# Basic usage (cleans carts older than 30 minutes)
npm run clear-old-carts

# Dry run (see what would be deleted without actually deleting)
npm run clear-old-carts -- --dry-run

# Custom time threshold (e.g., 60 minutes)
npm run clear-old-carts -- --minutes=60

# Show help
npm run clear-old-carts -- --help
```

**Features:**
- **Clears entire carts** when any item is old (not just individual items)
- Configurable time threshold (default: 30 minutes)
- Dry run mode for safe testing
- Detailed reporting of what will be cleared
- Two-tier cleanup:
  - Primary: Carts with any item older than specified threshold (default: 30 minutes)
  - Secondary: Very old carts (older than 24 hours)
- Works with both user carts (userId) and session carts (sessionId)

**Environment Variables:**
- `CART_CLEANUP_MINUTES`: Set default cutoff time in minutes

**Example Output:**
```
🧹 Starting old cart cleanup...
📅 Cleaning carts older than 30 minutes (before 2024-01-15T10:30:00.000Z)
📊 Found 3 cart(s) with old items:
  - User 123: 5 item(s)
  - Session abc456: 3 item(s)
  - User 789: 2 item(s)
📈 Total items to be deleted: 10
🗑️  Cleared cart for User 123: 5 item(s)
🗑️  Cleared cart for Session abc456: 3 item(s)
🗑️  Cleared cart for User 789: 2 item(s)
✅ Successfully cleared 3 cart(s) with 10 total item(s)
🧽 Found 1 very old cart(s) (older than 24 hours)
🗑️  Cleared very old cart for User 999: 4 item(s)
✅ Cleared 1 very old cart(s) with 4 total item(s)
✅ Cart cleanup completed successfully
```

### 2. `autoDeactivateTickets.ts` - Ticket Deactivation Script

Automatically deactivates expired tickets and events.

**Usage:**
```bash
npm run auto-deactivate
```

### 3. `refreshRecurringTickets.ts` - Recurring Tickets Script

Refreshes recurring ticket patterns.

**Usage:**
```bash
npm run refresh-recurring
```

## Setting Up Automated Cleanup

### Using Cron (Linux/macOS)

Add to your crontab to run cart cleanup every hour:
```bash
# Run cart cleanup every hour
0 * * * * cd /path/to/nightlife-backend && npm run clear-old-carts

# Run ticket deactivation daily at 2 AM
0 2 * * * cd /path/to/nightlife-backend && npm run auto-deactivate
```

### Using Windows Task Scheduler

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger (e.g., daily at 2 AM)
4. Set action to run: `cmd /c "cd C:\path\to\nightlife-backend && npm run clear-old-carts"`

### Using PM2 (Process Manager)

Create a `ecosystem.config.js` file:
```javascript
module.exports = {
  apps: [
    {
      name: 'cart-cleanup',
      script: 'npm',
      args: 'run clear-old-carts',
      cron_restart: '0 * * * *', // Every hour
      autorestart: false,
      watch: false
    }
  ]
};
```

Then run: `pm2 start ecosystem.config.js`

## Safety Considerations

1. **Always test with `--dry-run` first** to see what will be deleted
2. **Monitor database performance** after implementing automated cleanup
3. **Consider backup strategies** for critical data
4. **Set appropriate time thresholds** based on your business needs
5. **Monitor logs** for any errors during cleanup

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Ensure database is running and accessible
   - Check connection string in environment variables

2. **Permission Errors**
   - Ensure the script has proper database permissions
   - Check file system permissions for log files

3. **Memory Issues**
   - For large datasets, consider batching the cleanup
   - Monitor memory usage during execution

### Logs

Scripts output detailed logs to help with troubleshooting:
- ✅ Success messages
- ⚠️ Warnings
- ❌ Error messages
- 📊 Statistics and counts

## Contributing

When adding new maintenance scripts:

1. Follow the existing pattern in `clearOldCarts.ts`
2. Include comprehensive help documentation
3. Add dry-run functionality where appropriate
4. Include detailed logging and error handling
5. Update this README with usage instructions
6. Add the script to `package.json` scripts section
