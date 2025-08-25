# 🗑️ S3 Cleanup System

## Overview
The S3 Cleanup System automatically removes unused image files from S3 storage when entities are deleted, while preserving database records for history and audit purposes. This helps reduce storage costs and keeps the S3 bucket clean.

## 🎯 **What Gets Cleaned Up**

### **Ads (Global & Club)**
- **Image files**: Automatically removed from S3 when ads are deleted
- **When**: Both soft delete (preserving DB records) and hard delete
- **Why**: Ad images are no longer needed once deleted

### **Events**
- **Banner images**: Automatically removed from S3 when events are deleted
- **When**: Both soft delete (preserving DB records) and hard delete
- **Why**: Event banners are no longer needed once deleted

### **Clubs**
- **Profile images**: Automatically removed from S3 when clubs are deleted
- **PDF menus**: Automatically removed from S3 when clubs are deleted
- **When**: Both soft delete (preserving DB records) and hard delete
- **Why**: Club assets are no longer needed once deleted

### **Menu Items**
- **Item images**: Automatically removed from S3 when menu items are deleted
- **When**: Both soft delete (preserving DB records) and hard delete
- **Why**: Menu item images are no longer needed once deleted

## 🔧 **How It Works**

### **1. Soft Delete with S3 Cleanup**
```typescript
// Example: Ad soft deletion
if (hasRelatedPurchases) {
  // Soft delete - preserve DB record
  ad.isDeleted = true;
  ad.deletedAt = new Date();
  ad.isActive = false;
  await adRepo.save(ad);
  
  // Clean up S3 image (no longer needed)
  const s3CleanupResult = await cleanupAdS3Files(ad);
  
  res.json({ 
    message: "Ad soft deleted successfully",
    s3CleanupResult,
    note: "S3 image has been cleaned up"
  });
}
```

### **2. Hard Delete with S3 Cleanup**
```typescript
// Example: Ad hard deletion
if (!hasRelatedPurchases) {
  // Clean up S3 image
  const s3CleanupResult = await cleanupAdS3Files(ad);
  
  // Hard delete from DB
  await adRepo.remove(ad);
  
  res.json({ 
    message: "Ad permanently deleted successfully",
    s3CleanupResult
  });
}
```

## 🛠️ **Utility Functions**

### **`cleanupS3Image(imageUrl)`**
- Safely deletes a single image from S3
- Extracts S3 key from full URL
- Handles errors gracefully
- Returns boolean success status

### **`cleanupS3Images(imageUrls[])`**
- Batch cleanup of multiple images
- Returns summary of results
- Uses `Promise.allSettled` for reliability

### **Entity-Specific Functions**
- `cleanupAdS3Files(ad)` - Cleans up ad images
- `cleanupEventS3Files(event)` - Cleans up event banners
- `cleanupClubS3Files(club)` - Cleans up club profile images and PDFs
- `cleanupMenuItemS3Files(item)` - Cleans up menu item images

## 📊 **Response Format**

All deletion endpoints now return S3 cleanup results:

```json
{
  "message": "Entity deleted successfully",
  "s3CleanupResult": {
    "image": true,        // Successfully deleted
    "banner": false       // Failed to delete (if applicable)
  },
  "note": "S3 files have been cleaned up"
}
```

## 🚀 **Benefits**

### **Cost Savings**
- Reduces S3 storage costs
- Eliminates orphaned files
- Automatic cleanup prevents accumulation

### **Data Integrity**
- Preserves database records for history
- Maintains referential integrity
- Audit trail remains intact

### **Performance**
- Cleaner S3 bucket
- Faster S3 operations
- Reduced storage overhead

## ⚠️ **Important Notes**

### **Soft Delete Strategy**
- **Database**: Records marked as deleted (`isDeleted: true`)
- **S3**: Files removed immediately (no longer needed)
- **Result**: Clean storage + preserved history

### **Error Handling**
- S3 cleanup failures don't prevent deletion
- Errors are logged but not thrown
- Graceful degradation ensures deletion completes

### **Security**
- Only authorized users can trigger cleanup
- S3 operations use proper IAM permissions
- No public access to deleted files

## 🔍 **Monitoring**

### **Console Logs**
- ✅ Success: "Successfully deleted S3 image: [key]"
- ⚠️ Warning: "Could not extract S3 key from URL: [url]"
- ❌ Error: "Failed to delete S3 image: [url] [error]"

### **API Responses**
- All deletion endpoints include cleanup results
- Success/failure counts for batch operations
- Detailed notes about what was cleaned up

## 📝 **Implementation Examples**

### **Adding S3 Cleanup to New Controllers**
```typescript
import { cleanupEntityS3Files } from "../utils/s3Cleanup";

export const deleteEntity = async (req: Request, res: Response) => {
  // ... deletion logic ...
  
  // Clean up S3 files
  const s3CleanupResult = await cleanupEntityS3Files(entity);
  
  res.json({ 
    message: "Entity deleted",
    s3CleanupResult 
  });
};
```

### **Custom Cleanup Logic**
```typescript
// For entities with multiple file types
const s3CleanupResult = {
  image: await cleanupS3Image(entity.imageUrl),
  document: await cleanupS3Image(entity.documentUrl),
  thumbnail: await cleanupS3Image(entity.thumbnailUrl)
};
```

## 🎉 **Summary**

The S3 Cleanup System provides:
- **Automatic cleanup** of unused files
- **Cost reduction** through storage optimization
- **Data preservation** for audit and history
- **Consistent behavior** across all entity types
- **Error resilience** with graceful degradation
- **Comprehensive logging** for monitoring

This system ensures your S3 bucket stays clean while maintaining complete data integrity in your database. 🚀
