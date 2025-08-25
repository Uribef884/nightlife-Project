#!/usr/bin/env node

/**
 * Information script about the automatic ad cleanup system
 * Run with: node scripts/cleanup-orphaned-ads.js
 */

require('dotenv').config();
const { AppDataSource } = require('../src/config/data-source');

async function main() {
  try {
    console.log('🚀 Nightlife Project - Automatic Ad Cleanup System');
    console.log('==================================================');
    
    // Initialize database connection
    await AppDataSource.initialize();
    console.log('✅ Database connected');
    
    console.log('\n📊 Automatic Cleanup System Overview:');
    console.log('   This system automatically cleans up ads when their targets are deleted.');
    console.log('   No manual cleanup is needed - everything happens automatically!');
    
    console.log('\n🎯 What Gets Cleaned Up:');
    console.log('   1. When a TICKET is deleted:');
    console.log('      - All ads targeting that ticket are deactivated');
    console.log('      - If ticket has purchases: Soft delete (preserves history)');
    console.log('      - If no purchases: Hard delete (completely removed)');
    
    console.log('\n   2. When an EVENT is deleted:');
    console.log('      - All ads targeting that event are deactivated');
    console.log('      - All ads targeting the event\'s tickets are deactivated');
    console.log('      - If event has purchased tickets: Soft delete');
    console.log('      - If no purchases: Hard delete');
    
    console.log('\n✨ Benefits:');
    console.log('   ✅ No more broken ads pointing to deleted content');
    console.log('   ✅ Clean, consistent user experience');
    console.log('   ✅ Purchase history preserved when needed');
    console.log('   ✅ Automatic cleanup - no manual intervention required');
    
    console.log('\n🔧 How It Works:');
    console.log('   - Delete a ticket → Associated ads automatically deactivated');
    console.log('   - Delete an event → Event ads + all ticket ads automatically deactivated');
    console.log('   - All cleanup happens in a single transaction');
    
    console.log('\n🎉 Your system is fully automated!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    // Close database connection
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('\n🔌 Database connection closed');
    }
    process.exit(0);
  }
}

// Run the script
main();
