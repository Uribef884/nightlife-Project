import { useState, useCallback } from 'react';
import { useCartStore } from '@/stores/cart.store';

interface UseClubProtectionProps {
  clubId: string;
  clubName?: string;
}

interface ClubProtectionResult {
  showClubModal: boolean;
  currentClubName?: string;
  handleAddWithProtection: (addFunction: () => Promise<void>) => Promise<void>;
  handleClearCartAndClose: () => Promise<void>;
  handleCancelClubChange: () => void;
}

export function useClubProtection({ 
  clubId, 
  clubName = "este club" 
}: UseClubProtectionProps): ClubProtectionResult {
  const [showClubModal, setShowClubModal] = useState(false);
  const [currentClubName, setCurrentClubName] = useState<string>();
  
  const { items, checkClubConflict, clearCart, getClubName } = useCartStore();

  const handleAddWithProtection = useCallback(async (addFunction: () => Promise<void>) => {
    const { hasConflict, currentClubId } = checkClubConflict(clubId);
    
    if (hasConflict && currentClubId) {
      // Fetch the actual club name
      try {
        const actualClubName = await getClubName(currentClubId);
        setCurrentClubName(actualClubName);
      } catch (error) {
        console.error('Error fetching club name:', error);
        setCurrentClubName(`Club ${currentClubId}`);
      }
      setShowClubModal(true);
      return;
    }
    
    // No conflict, proceed with adding
    await addFunction();
  }, [clubId, checkClubConflict, getClubName]);

  const handleClearCartAndClose = useCallback(async () => {
    await clearCart();
    setShowClubModal(false);
    setCurrentClubName(undefined);
  }, [clearCart]);

  const handleCancelClubChange = useCallback(() => {
    setShowClubModal(false);
    setCurrentClubName(undefined);
  }, []);

  return {
    showClubModal,
    currentClubName,
    handleAddWithProtection,
    handleClearCartAndClose,
    handleCancelClubChange,
  };
}
