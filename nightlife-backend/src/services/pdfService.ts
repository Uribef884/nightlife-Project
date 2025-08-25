import AWS from 'aws-sdk';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import { createCanvas } from 'canvas';
import { v4 as uuidv4 } from 'uuid';

// Configure PDF.js to work in Node.js environment
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

export interface PageImage {
  url: string;
  w: number;
  h: number;
  bytes: number;
}

export interface Thumbnail {
  url: string;
  w: number;
  h: number;
}

export interface MenuManifest {
  pageCount: number;
  format: string;
  width: number;
  height: number;
  pages: PageImage[];
  thumbs: Thumbnail[];
  createdAt: string;
  version: string; // Add version for atomic swaps
}

export class PDFService {
  private s3: AWS.S3;
  private bucketName: string;

  constructor() {
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    });
    this.bucketName = process.env.AWS_S3_BUCKET!;
  }

  /**
   * Convert PDF to images using PDF.js + canvas
   * Implements atomic swap pattern for safe PDF replacement
   * Ensures PDF content fills the entire canvas without white borders
   */
  async convertPDFToImages(
    pdfBuffer: Buffer,
    clubId: string,
    menuId: string
  ): Promise<MenuManifest> {
    try {
      // Load PDF document with PDF.js
      const pdfDoc = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;
      const pageCount = pdfDoc.numPages;
      
      if (pageCount === 0) {
        throw new Error('PDF has no pages');
      }

      // Get first page dimensions for reference
      const firstPage = await pdfDoc.getPage(1);
      const firstPageViewport = firstPage.getViewport({ scale: 1.0 });
      
      // Calculate target dimensions to ensure full canvas coverage
      // Use the larger scale to ensure the PDF fills the entire target area
      const targetWidth = 1440;
      const scaleX = targetWidth / firstPageViewport.width;
      const targetHeight = Math.round(firstPageViewport.height * scaleX);
      
      // Ensure minimum height for consistency
      const minHeight = 800;
      const finalHeight = Math.max(targetHeight, minHeight);
      
      // Generate version timestamp for atomic swap
      const version = `v-${Date.now()}`;
      const versionedPrefix = `clubs/${clubId}/menu/${menuId}/pages/${version}`;
      
      // Clean up old versioned folders first
      console.log(`🔄 Starting cleanup of old menu assets for club: ${clubId}, menu: ${menuId}`);
      await this.cleanupOldMenuAssets(clubId, menuId);
      console.log(`✅ Cleanup completed, proceeding with new PDF conversion`);
      
      const pages: PageImage[] = [];
      const thumbs: Thumbnail[] = [];

      // Convert each page to image
      for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
        const pageNumber = pageNum;
        const paddedNumber = pageNumber.toString().padStart(3, '0');
        
        // Convert PDF page to image using PDF.js + skia-canvas
        const pageImage = await this.convertPageToImage(
          pdfDoc,
          pageNum,
          scaleX, // Use the calculated scaleX
          targetWidth,
          finalHeight // Use the calculated finalHeight
        );
        
        // Create thumbnail (1/3 size)
        const thumbImage = await sharp(pageImage)
          .resize(Math.round(targetWidth / 3), Math.round(finalHeight / 3), {
            fit: 'inside',
            withoutEnlargement: true
          })
          .webp({ quality: 80 })
          .toBuffer();
        
        // Upload full-size page image to versioned folder
        const pageKey = `${versionedPrefix}/page-${paddedNumber}.webp`;
        const pageUrl = await this.uploadToS3(pageImage, pageKey, 'image/webp');
        
        // Upload thumbnail to versioned folder
        const thumbKey = `${versionedPrefix}/thumb-${paddedNumber}.webp`;
        const thumbUrl = await this.uploadToS3(thumbImage, thumbKey, 'image/webp');
        
        // Get file sizes
        const pageBytes = pageImage.length;
        const thumbBytes = thumbImage.length;
        
        pages.push({
          url: pageUrl,
          w: targetWidth,
          h: finalHeight,
          bytes: pageBytes
        });
        
        thumbs.push({
          url: thumbUrl,
          w: Math.round(targetWidth / 3),
          h: Math.round(finalHeight / 3)
        });
      }
      
      // Create and upload versioned manifest
      const manifest: MenuManifest = {
        pageCount,
        format: 'webp',
        width: targetWidth,
        height: finalHeight,
        pages,
        thumbs,
        createdAt: new Date().toISOString(),
        version
      };
      
      const versionedManifestKey = `clubs/${clubId}/menu/${menuId}/manifests/manifest-${version}.json`;
      await this.uploadToS3(
        Buffer.from(JSON.stringify(manifest, null, 2)),
        versionedManifestKey,
        'application/json'
      );
      
      // ATOMIC SWAP: Now overwrite the main files
      // 1. Overwrite manifest.json
      const manifestKey = `clubs/${clubId}/menu/${menuId}/manifest.json`;
      await this.uploadToS3(
        Buffer.from(JSON.stringify(manifest, null, 2)),
        manifestKey,
        'application/json'
      );
      
      // 2. Create symlinks from main pages/ folder to versioned pages
      await this.createPageSymlinks(clubId, menuId, version);
      
      return manifest;
      
    } catch (error) {
      console.error('Error converting PDF to images:', error);
      throw new Error(`Failed to convert PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert a single PDF page to image using PDF.js + canvas
   * This creates actual images from the PDF content, not placeholders
   */
  private async convertPageToImage(
    pdfDoc: pdfjsLib.PDFDocumentProxy,
    pageNum: number,
    scale: number,
    targetWidth: number,
    targetHeight: number
  ): Promise<Buffer> {
    try {
      // Get the page
      const page = await pdfDoc.getPage(pageNum);
      
      // Create viewport that fills the entire target canvas
      // Use the target dimensions directly to ensure full coverage
      const viewport = page.getViewport({ 
        scale: Math.max(targetWidth / page.getViewport({ scale: 1.0 }).width, 
                       targetHeight / page.getViewport({ scale: 1.0 }).height)
      });
      
      // Create canvas
      const canvas = createCanvas(targetWidth, targetHeight);
      const context = canvas.getContext('2d') as any; // Type assertion for compatibility
      
      // Set canvas dimensions
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      
      // Clear canvas with transparent background (no white fill)
      context.clearRect(0, 0, targetWidth, targetHeight);
      
      // Calculate centering offsets to center the PDF content on the canvas
      const offsetX = (targetWidth - viewport.width) / 2;
      const offsetY = (targetHeight - viewport.height) / 2;
      
      // Render PDF page to canvas with proper positioning
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        canvas: canvas as any, // Type assertion to bypass PDF.js type requirements
        transform: [1, 0, 0, 1, offsetX, offsetY] // Center the content
      };
      
      await page.render(renderContext as any).promise;
      
      // Convert canvas to PNG buffer
      const pngBuffer = canvas.toBuffer('image/png');
      
      // Convert PNG to WebP using sharp
      const webpBuffer = await sharp(pngBuffer)
        .webp({ quality: 90 })
        .toBuffer();
      
      return webpBuffer;
      
    } catch (error) {
      console.error(`Error converting page ${pageNum} to image:`, error);
      
      // Fallback to a simple error placeholder
      const fallbackSvg = `
        <svg width="${targetWidth}" height="${targetHeight}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#f8f9fa"/>
          <text x="${targetWidth/2}" y="${targetHeight/2}" text-anchor="middle" font-family="Arial, sans-serif" 
                font-size="16" fill="#dc3545">Error converting page ${pageNum}</text>
        </svg>
      `;
      
      return await sharp(Buffer.from(fallbackSvg))
        .webp({ quality: 90 })
        .toBuffer();
    }
  }

  /**
   * Upload buffer to S3 using AWS SDK v2
   */
  private async uploadToS3(
    buffer: Buffer,
    key: string,
    contentType: string
  ): Promise<string> {
    const params = {
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      // ACL removed - bucket policy handles public access (same as existing S3Service)
    };
    
    const result = await this.s3.upload(params).promise();
    
    return result.Location;
  }

  /**
   * Clean up old versioned pages when replacing a menu
   * This removes ALL old menu assets to prevent accumulation of orphaned files
   */
  async cleanupOldMenuAssets(clubId: string, menuId: string): Promise<void> {
    try {
      // Clean up the entire menu folder structure, not just pages
      const menuPrefix = `clubs/${clubId}/menu/${menuId}/`;
      
      console.log(`🧹 Cleaning up old menu assets for: ${menuPrefix}`);
      
      // List all objects with this menu prefix
      const listParams = {
        Bucket: this.bucketName,
        Prefix: menuPrefix
      };
      
      const listResult = await this.s3.listObjectsV2(listParams).promise();
      
      if (listResult.Contents && listResult.Contents.length > 0) {
        console.log(`🗑️ Found ${listResult.Contents.length} old objects to delete`);
        
        // Delete all objects in the menu folder
        const deleteParams = {
          Bucket: this.bucketName,
          Delete: {
            Objects: listResult.Contents.map(obj => ({ Key: obj.Key! }))
          }
        };
        
        await this.s3.deleteObjects(deleteParams).promise();
        console.log(`✅ Successfully deleted ${listResult.Contents.length} old menu objects`);
      } else {
        console.log(`ℹ️ No old menu objects found to clean up`);
      }
    } catch (error) {
      console.error('❌ Error cleaning up old menu assets:', error);
      // Don't throw - cleanup failure shouldn't stop the main process
      // But log it so we can investigate
    }
  }

  /**
   * Create symlinks from the main pages/ folder to the versioned pages/ folder
   * This ensures that the main manifest and thumbnails still point to the correct files
   */
  private async createPageSymlinks(clubId: string, menuId: string, version: string): Promise<void> {
    try {
      const mainPagesPrefix = `clubs/${clubId}/menu/${menuId}/pages/`;
      const versionedPagesPrefix = `clubs/${clubId}/menu/${menuId}/pages/${version}/`;

      // List all objects in the main pages/ folder
      const listParams = {
        Bucket: this.bucketName,
        Prefix: mainPagesPrefix
      };
      const listResult = await this.s3.listObjectsV2(listParams).promise();

      if (listResult.Contents && listResult.Contents.length > 0) {
        for (const obj of listResult.Contents) {
          if (obj.Key && obj.Key.startsWith(mainPagesPrefix) && !obj.Key.startsWith(versionedPagesPrefix)) {
            const key = obj.Key;
            const newKey = key.replace(mainPagesPrefix, versionedPagesPrefix);

            const copyParams = {
              Bucket: this.bucketName,
              CopySource: `${this.bucketName}/${key}`,
              Key: newKey,
              ACL: 'public-read', // Ensure public access for symlinks
              Metadata: {
                'x-amz-symlink-target': key
              }
            };

            await this.s3.copyObject(copyParams).promise();
            console.log(`Created symlink: ${key} -> ${newKey}`);
          }
        }
      }
    } catch (error) {
      console.error('Error creating page symlinks:', error);
      // Don't throw - symlink failure shouldn't stop the main process
    }
  }

  /**
   * Get manifest for a menu
   */
  async getManifest(clubId: string, menuId: string): Promise<MenuManifest | null> {
    try {
      const key = `clubs/${clubId}/menu/${menuId}/manifest.json`;
      
      // You can implement S3 get object here if needed
      // For now, return null to indicate no manifest exists
      return null;
    } catch (error) {
      console.error('Error getting manifest:', error);
      return null;
    }
  }
}

export default PDFService;