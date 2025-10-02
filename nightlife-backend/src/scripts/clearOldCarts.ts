import { AppDataSource } from "../config/data-source";
import { UnifiedCartItem } from "../entities/UnifiedCartItem";
import { nowInBogota } from "../utils/timezone";

// Handle command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

async function run() {
  console.log("🧹 Starting old cart cleanup...");

  try {
    await AppDataSource.initialize();
    const cartRepo = AppDataSource.getRepository(UnifiedCartItem);

    // Calculate cutoff time (30 minutes ago by default, but configurable)
    const cutoffMinutes = process.env.CART_CLEANUP_MINUTES ? parseInt(process.env.CART_CLEANUP_MINUTES) : 30;
    const cutoffTime = nowInBogota().minus({ minutes: cutoffMinutes }).toJSDate();

    const cutoffTimeBogota = nowInBogota().minus({ minutes: cutoffMinutes });
    console.log(`📅 ${isDryRun ? 'Would clean' : 'Cleaning'} carts older than ${cutoffMinutes} minutes (before ${cutoffTimeBogota.toFormat('yyyy-MM-dd HH:mm:ss')} Bogota time)`);

    // First, find all user/session IDs that have old cart items
    const oldCartOwnersQuery = cartRepo
      .createQueryBuilder("cart")
      .select([
        "cart.userId",
        "cart.sessionId",
        "COUNT(*) as itemCount"
      ])
      .where("cart.updatedAt < :cutoffTime", { cutoffTime })
      .andWhere("(cart.userId IS NOT NULL OR cart.sessionId IS NOT NULL)")
      .groupBy("cart.userId, cart.sessionId")
      .orderBy("cart.userId", "ASC")
      .addOrderBy("cart.sessionId", "ASC")
      .getRawMany();

    const oldCartOwners = await oldCartOwnersQuery;
    
    if (oldCartOwners.length === 0) {
      console.log("✅ No old carts found.");
      return;
    }

    console.log(`📊 Found ${oldCartOwners.length} cart(s) with old items:`);
    oldCartOwners.forEach((owner: any) => {
      const identifier = owner.cart_userId ? `User ${owner.cart_userId}` : `Session ${owner.cart_sessionId}`;
      // TypeORM raw queries return count as a string, so we need to parse it
      const itemCount = parseInt(owner.itemCount) || 0;
      console.log(`  - ${identifier}: ${itemCount} item(s)`);
    });

    // Calculate total items that will be deleted (including all items in these carts)
    let totalItemsToDelete = 0;
    for (const owner of oldCartOwners) {
      const countQuery = cartRepo
        .createQueryBuilder("cart")
        .where(
          owner.cart_userId 
            ? "cart.userId = :userId" 
            : "cart.sessionId = :sessionId",
          owner.cart_userId 
            ? { userId: owner.cart_userId } 
            : { sessionId: owner.cart_sessionId }
        )
        .getCount();
      
      const count = await countQuery;
      totalItemsToDelete += count;
    }

    console.log(`📈 Total items to be deleted: ${totalItemsToDelete}`);

    if (isDryRun) {
      console.log("🔍 DRY RUN - No items were actually deleted");
      return;
    }

    // Delete all items from carts that have old items
    let totalDeleted = 0;
    for (const owner of oldCartOwners) {
      const deleteResult = await cartRepo
        .createQueryBuilder()
        .delete()
        .from(UnifiedCartItem)
        .where(
          owner.cart_userId 
            ? "userId = :userId" 
            : "sessionId = :sessionId",
          owner.cart_userId 
            ? { userId: owner.cart_userId } 
            : { sessionId: owner.cart_sessionId }
        )
        .execute();

      if (deleteResult.affected && deleteResult.affected > 0) {
        totalDeleted += deleteResult.affected;
        const identifier = owner.cart_userId ? `User ${owner.cart_userId}` : `Session ${owner.cart_sessionId}`;
        console.log(`🗑️  Cleared cart for ${identifier}: ${deleteResult.affected} item(s)`);
      }
    }

    if (totalDeleted > 0) {
      console.log(`✅ Successfully cleared ${oldCartOwners.length} cart(s) with ${totalDeleted} total item(s)`);
    } else {
      console.log("⚠️  No items were deleted (this shouldn't happen if carts were found)");
    }

    // Optional: Also clean up very old carts (e.g., older than 24 hours) more aggressively
    const veryOldCutoff = nowInBogota().minus({ hours: 24 }).toJSDate();

    const veryOldCartOwnersQuery = cartRepo
      .createQueryBuilder("cart")
      .select([
        "cart.userId",
        "cart.sessionId",
        "COUNT(*) as itemCount"
      ])
      .where("cart.updatedAt < :veryOldCutoff", { veryOldCutoff })
      .andWhere("(cart.userId IS NOT NULL OR cart.sessionId IS NOT NULL)")
      .groupBy("cart.userId, cart.sessionId")
      .orderBy("cart.userId", "ASC")
      .addOrderBy("cart.sessionId", "ASC")
      .getRawMany();

    const veryOldCartOwners = await veryOldCartOwnersQuery;

    if (veryOldCartOwners.length > 0) {
      console.log(`🧽 Found ${veryOldCartOwners.length} very old cart(s) (older than 24 hours)`);
      
      if (!isDryRun) {
        let veryOldTotalDeleted = 0;
        for (const owner of veryOldCartOwners) {
          const deleteResult = await cartRepo
            .createQueryBuilder()
            .delete()
            .from(UnifiedCartItem)
            .where(
              owner.cart_userId 
                ? "userId = :userId" 
                : "sessionId = :sessionId",
              owner.cart_userId 
                ? { userId: owner.cart_userId } 
                : { sessionId: owner.cart_sessionId }
            )
            .execute();

          if (deleteResult.affected && deleteResult.affected > 0) {
            veryOldTotalDeleted += deleteResult.affected;
            const identifier = owner.cart_userId ? `User ${owner.cart_userId}` : `Session ${owner.cart_sessionId}`;
            console.log(`🗑️  Cleared very old cart for ${identifier}: ${deleteResult.affected} item(s)`);
          }
        }
        
        if (veryOldTotalDeleted > 0) {
          console.log(`✅ Cleared ${veryOldCartOwners.length} very old cart(s) with ${veryOldTotalDeleted} total item(s)`);
        }
      } else {
        console.log("🔍 DRY RUN - Very old carts would be cleared");
      }
    }

    console.log("✅ Cart cleanup completed successfully");

  } catch (error) {
    console.error("❌ Error during cart cleanup:", error);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
    process.exit(0);
  }
}

// Handle help and other arguments
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🧹 Cart Cleanup Script

Clears entire carts (all items) when any item in the cart is older than the specified threshold.

Usage:
  npm run clear-old-carts [options]

Options:
  --help, -h          Show this help message
  --dry-run          Show what would be deleted without actually deleting
  --minutes=30       Set custom cutoff time in minutes (default: 30)

Environment Variables:
  CART_CLEANUP_MINUTES    Set default cutoff time in minutes

Examples:
  npm run clear-old-carts
  npm run clear-old-carts -- --minutes=60
  npm run clear-old-carts -- --dry-run

Note: This script clears ENTIRE carts, not just old items. If any item in a cart
is older than the threshold, the entire cart (all items) will be cleared.
  `);
  process.exit(0);
}

if (isDryRun) {
  console.log("🔍 DRY RUN MODE - No items will be deleted");
}

// Parse custom minutes from command line
const minutesArg = args.find(arg => arg.startsWith('--minutes='));
if (minutesArg) {
  const minutes = parseInt(minutesArg.split('=')[1]);
  if (!isNaN(minutes) && minutes > 0) {
    process.env.CART_CLEANUP_MINUTES = minutes.toString();
  }
}

run();
