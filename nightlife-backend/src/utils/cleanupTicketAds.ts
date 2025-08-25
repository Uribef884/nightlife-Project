import { AppDataSource } from "../config/data-source";
import { Ad } from "../entities/Ad";

/**
 * Utility function to clean up ads associated with a specific ticket
 * This is called automatically when a ticket is deleted
 */
export async function cleanupTicketAds(ticketId: string): Promise<{
  adsFound: number;
  adsCleaned: number;
}> {
  const adRepo = AppDataSource.getRepository(Ad);
  
  const result = {
    adsFound: 0,
    adsCleaned: 0
  };

  try {
    // Find all ads that target this specific ticket
    const associatedAds = await adRepo.find({ 
      where: { 
        targetType: "ticket", 
        targetId: ticketId,
        isActive: true 
      } 
    });

    result.adsFound = associatedAds.length;

    // Soft delete all associated ads
    for (const ad of associatedAds) {
      ad.isActive = false;
      ad.isDeleted = true;
      ad.deletedAt = new Date();
      await adRepo.save(ad);
      result.adsCleaned++;
    }

    if (result.adsCleaned > 0) {
      console.log(`🧹 Cleaned up ${result.adsCleaned} ads for deleted ticket ${ticketId}`);
    }
    
  } catch (error) {
    console.error(`Error cleaning up ads for ticket ${ticketId}:`, error);
  }

  return result;
}

/**
 * Utility function to clean up ads associated with a specific event
 * This is called automatically when an event is deleted
 */
export async function cleanupEventAds(eventId: string): Promise<{
  adsFound: number;
  adsCleaned: number;
}> {
  const adRepo = AppDataSource.getRepository(Ad);
  
  const result = {
    adsFound: 0,
    adsCleaned: 0
  };

  try {
    // Find all ads that target this specific event
    const associatedAds = await adRepo.find({ 
      where: { 
        targetType: "event", 
        targetId: eventId,
        isActive: true 
      } 
    });

    result.adsFound = associatedAds.length;

    // Soft delete all associated ads
    for (const ad of associatedAds) {
      ad.isActive = false;
      ad.isDeleted = true;
      ad.deletedAt = new Date();
      await adRepo.save(ad);
      result.adsCleaned++;
    }

    if (result.adsCleaned > 0) {
      console.log(`🧹 Cleaned up ${result.adsCleaned} ads for deleted event ${eventId}`);
    }
    
  } catch (error) {
    console.error(`Error cleaning up ads for event ${eventId}:`, error);
  }

  return result;
}

/**
 * Utility function to clean up all ads associated with an event and its tickets
 * This handles the complete cleanup chain when an event is deleted
 */
export async function cleanupEventAndTicketAds(eventId: string, ticketIds: string[]): Promise<{
  eventAdsFound: number;
  eventAdsCleaned: number;
  ticketAdsFound: number;
  ticketAdsCleaned: number;
  totalAdsCleaned: number;
}> {
  const result = {
    eventAdsFound: 0,
    eventAdsCleaned: 0,
    ticketAdsFound: 0,
    ticketAdsCleaned: 0,
    totalAdsCleaned: 0
  };

  try {
    // Clean up event ads
    const eventAdResult = await cleanupEventAds(eventId);
    result.eventAdsFound = eventAdResult.adsFound;
    result.eventAdsCleaned = eventAdResult.adsCleaned;

    // Clean up ads for all associated tickets
    for (const ticketId of ticketIds) {
      const ticketAdResult = await cleanupTicketAds(ticketId);
      result.ticketAdsFound += ticketAdResult.adsFound;
      result.ticketAdsCleaned += ticketAdResult.adsCleaned;
    }

    result.totalAdsCleaned = result.eventAdsCleaned + result.ticketAdsCleaned;

    if (result.totalAdsCleaned > 0) {
      console.log(`🧹 Complete cleanup for event ${eventId}: ${result.totalAdsCleaned} total ads cleaned up`);
    }
    
  } catch (error) {
    console.error(`Error during complete cleanup for event ${eventId}:`, error);
  }

  return result;
}
