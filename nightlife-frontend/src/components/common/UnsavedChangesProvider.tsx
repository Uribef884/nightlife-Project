'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { UnsavedChangesModal } from '@/components/cart/UnsavedChangesModal';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

interface UnsavedChangesProviderProps {
  children: React.ReactNode;
  hasUnsavedChanges: boolean;
  onSave: () => Promise<void> | void;
  onDiscard?: () => void;
  shouldBlockNavigation?: (pathname: string) => boolean;
}

export function UnsavedChangesProvider({
  children,
  hasUnsavedChanges,
  onSave,
  onDiscard,
  shouldBlockNavigation,
}: UnsavedChangesProviderProps) {
  const [showModal, setShowModal] = useState(false);

  const {
    handleNavigation,
    saveAndNavigate,
    discardAndNavigate,
    cancelNavigation,
    pendingNavigation,
  } = useUnsavedChanges({
    hasUnsavedChanges,
    onSave,
    onDiscard,
    shouldBlockNavigation,
  });

  // Listen for unsaved changes detection
  useEffect(() => {
    const handleUnsavedChangesDetected = () => {
      setShowModal(true);
    };

    window.addEventListener('unsavedChangesDetected', handleUnsavedChangesDetected);
    
    return () => {
      window.removeEventListener('unsavedChangesDetected', handleUnsavedChangesDetected);
    };
  }, []);

  // Handle modal actions
  const handleSave = useCallback(async () => {
    setShowModal(false);
    try {
      await onSave();
      // Navigate after successful save using Next.js router
      if (pendingNavigation) {
        window.location.href = pendingNavigation;
      }
    } catch (error) {
      console.error('Error saving changes:', error);
      // Don't navigate if save failed
    }
  }, [onSave, pendingNavigation]);

  const handleDiscard = useCallback(() => {
    setShowModal(false);
    onDiscard?.();
    // Navigate after discarding changes using Next.js router
    if (pendingNavigation) {
      window.location.href = pendingNavigation;
    }
  }, [onDiscard, pendingNavigation]);

  const handleCancel = useCallback(() => {
    setShowModal(false);
    cancelNavigation();
  }, [cancelNavigation]);


  return (
    <>
      {children}
      <UnsavedChangesModal
        isOpen={showModal}
        onClose={handleCancel}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
    </>
  );
}
