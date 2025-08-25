import { S3Service } from "../services/s3Service";

/**
 * Utility to clean up S3 files when entities are soft-deleted
 * This helps save storage costs while preserving database records for history
 */

/**
 * Extract S3 key from a full S3 URL
 */
function extractS3Key(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  
  try {
    const urlObj = new URL(url);
    // Remove leading slash from pathname
    return urlObj.pathname.substring(1);
  } catch {
    return null;
  }
}

/**
 * Safely delete an image from S3
 */
export async function cleanupS3Image(imageUrl: string | null | undefined): Promise<boolean> {
  if (!imageUrl) return false;
  
  try {
    const key = extractS3Key(imageUrl);
    if (!key) {
      console.warn('⚠️ Could not extract S3 key from URL:', imageUrl);
      return false;
    }
    
    await S3Service.deleteFile(key);
    console.log('✅ Successfully deleted S3 image:', key);
    return true;
  } catch (error) {
    console.error('❌ Failed to delete S3 image:', imageUrl, error);
    return false;
  }
}

/**
 * Clean up multiple S3 images
 */
export async function cleanupS3Images(imageUrls: (string | null | undefined)[]): Promise<{
  total: number;
  successful: number;
  failed: number;
}> {
  const results = await Promise.allSettled(
    imageUrls.map(url => cleanupS3Image(url))
  );
  
  const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
  const failed = results.filter(r => r.status === 'rejected').length;
  
  return {
    total: imageUrls.length,
    successful,
    failed
  };
}

/**
 * Clean up club-related S3 files (profile image, PDF menu)
 */
export async function cleanupClubS3Files(club: {
  profileImageUrl?: string | null;
  pdfMenuUrl?: string | null;
}): Promise<{
  profileImage: boolean;
  pdfMenu: boolean;
}> {
  const [profileImage, pdfMenu] = await Promise.all([
    cleanupS3Image(club.profileImageUrl),
    cleanupS3Image(club.pdfMenuUrl)
  ]);
  
  return { profileImage, pdfMenu };
}

/**
 * Clean up event-related S3 files (banner)
 */
export async function cleanupEventS3Files(event: {
  bannerUrl?: string | null;
}): Promise<{
  banner: boolean;
}> {
  const banner = await cleanupS3Image(event.bannerUrl);
  return { banner };
}

/**
 * Clean up ad-related S3 files (image)
 */
export async function cleanupAdS3Files(ad: {
  imageUrl: string;
}): Promise<{
  image: boolean;
}> {
  const image = await cleanupS3Image(ad.imageUrl);
  return { image };
}

/**
 * Clean up menu item-related S3 files (image)
 */
export async function cleanupMenuItemS3Files(item: {
  imageUrl?: string | null;
}): Promise<{
  image: boolean;
}> {
  const image = await cleanupS3Image(item.imageUrl);
  return { image };
}
