import { AppDataSource } from "../config/data-source";
import { User } from "../entities/User";

export class UserService {
  /**
   * Add a club to a user's owned clubs array
   */
  static async addClubToUser(userId: string, clubId: string): Promise<void> {
    const userRepo = AppDataSource.getRepository(User);
    
    await userRepo.manager.transaction(async (manager) => {
      const user = await manager.findOneBy(User, { id: userId });
      if (!user) {
        throw new Error('User not found');
      }
      
      // Only club owners can have clubIds
      if (user.role === "clubowner") {
        // Dedupe and add
        if (!user.clubIds?.includes(clubId)) {
          user.clubIds = [...(user.clubIds || []), clubId];
          
          // Set as active club if they don't have one
          if (!user.clubId) {
            user.clubId = clubId;
          }
          
          await manager.save(user);
        }
      }
    });
  }
  
  /**
   * Remove a club from a user's owned clubs array
   */
  static async removeClubFromUser(userId: string, clubId: string): Promise<void> {
    const userRepo = AppDataSource.getRepository(User);
    
    await userRepo.manager.transaction(async (manager) => {
      const user = await manager.findOneBy(User, { id: userId });
      if (!user) {
        throw new Error('User not found');
      }
      
      // Only club owners can have clubIds
      if (user.role === "clubowner" && user.clubIds) {
        // Remove from array
        user.clubIds = user.clubIds.filter(id => id !== clubId);
        
        // If it was active, set fallback
        if (user.clubId === clubId) {
          user.clubId = user.clubIds[0] || undefined;
        }
        
        // Only demote to user if they don't have other clubs
        if (user.clubIds.length === 0) {
          user.role = "user";
          user.clubIds = null; // Clear clubIds for non-club owners
        }
      } else {
        // For non-club owners, just clear the active club
        if (user.clubId === clubId) {
          user.clubId = undefined;
        }
      }
      
      await manager.save(user);
    });
  }
  
  /**
   * Set a user's active club (must be in their clubIds array)
   */
  static async setActiveClub(userId: string, clubId: string): Promise<void> {
    const userRepo = AppDataSource.getRepository(User);
    
    const user = await userRepo.findOneBy({ id: userId });
    if (!user) {
      throw new Error('User not found');
    }
    
    if (!user.clubIds?.includes(clubId)) {
      throw new Error('User is not owner of this club');
    }
    
    user.clubId = clubId;
    await userRepo.save(user);
  }
  
  /**
   * Check if a user owns a specific club
   */
  static async userOwnsClub(userId: string, clubId: string): Promise<boolean> {
    const userRepo = AppDataSource.getRepository(User);
    
    const user = await userRepo.findOneBy({ id: userId });
    return user?.clubIds?.includes(clubId) || false;
  }

  /**
   * Admin method: Add a club to a user's owned clubs (forces club owner role)
   */
  static async adminAddClubToUser(userId: string, clubId: string): Promise<void> {
    const userRepo = AppDataSource.getRepository(User);
    
    await userRepo.manager.transaction(async (manager) => {
      const user = await manager.findOneBy(User, { id: userId });
      if (!user) {
        throw new Error('User not found');
      }
      
      // Force user to be club owner
      if (user.role !== "clubowner") {
        user.role = "clubowner";
      }
      
      // Initialize clubIds if null
      if (!user.clubIds) {
        user.clubIds = [];
      }
      
      // Add club if not already owned
      if (!user.clubIds.includes(clubId)) {
        user.clubIds = [...user.clubIds, clubId];
        
        // Set as active club if they don't have one
        if (!user.clubId) {
          user.clubId = clubId;
        }
        
        await manager.save(user);
      }
    });
  }
  
  /**
   * Admin method: Remove a club from a user's owned clubs
   */
  static async adminRemoveClubFromUser(userId: string, clubId: string): Promise<void> {
    const userRepo = AppDataSource.getRepository(User);
    
    await userRepo.manager.transaction(async (manager) => {
      const user = await manager.findOneBy(User, { id: userId });
      if (!user) {
        throw new Error('User not found');
      }
      
      // Only proceed if user is a club owner with clubIds
      if (user.role === "clubowner" && user.clubIds) {
        // Remove club from array
        user.clubIds = user.clubIds.filter(id => id !== clubId);
        
        // If it was active, set fallback
        if (user.clubId === clubId) {
          user.clubId = user.clubIds[0] || undefined;
        }
        
        // Demote to user if no clubs left
        if (user.clubIds.length === 0) {
          user.role = "user";
          user.clubIds = null;
        }
        
        await manager.save(user);
      }
    });
  }
}
