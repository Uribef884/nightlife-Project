'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ModalData {
  show: boolean;
  type: 'success' | 'error';
  title: string;
  message: string;
}

// Global modal state
let globalModalState: ModalData = {
  show: false,
  type: 'success',
  title: '',
  message: ''
};

// Global listeners
const listeners = new Set<() => void>();

// Global modal functions
export const showGlobalModal = (type: 'success' | 'error', title: string, message: string) => {
  globalModalState = {
    show: true,
    type,
    title,
    message
  };
  // Notify all listeners
  listeners.forEach(listener => listener());
};

export const hideGlobalModal = () => {
  globalModalState = {
    show: false,
    type: 'success',
    title: '',
    message: ''
  };
  // Notify all listeners
  listeners.forEach(listener => listener());
};

// Global Modal Component
export function GlobalModal() {
  const [modal, setModal] = useState<ModalData>(globalModalState);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Add listener
    const listener = () => {
      setModal({ ...globalModalState });
    };
    
    listeners.add(listener);
    
    return () => {
      listeners.delete(listener);
    };
  }, []);

  if (!mounted || !modal.show) {
    return null;
  }

  const modalContent = (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 sm:mx-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-6">
          {/* Modal Header */}
          <div className="flex items-center mb-4">
            {modal.type === 'success' ? (
              <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : (
              <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            )}
            <h3
              className={`ml-3 text-base sm:text-lg font-semibold ${
                modal.type === 'success' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
              }`}
            >
              {modal.title}
            </h3>
          </div>

          {/* Modal Body */}
          <div className="mb-4 sm:mb-6">
            <p
              className={`text-sm sm:text-base ${
                modal.type === 'success' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
              }`}
            >
              {modal.message}
            </p>
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end">
            <button
              onClick={hideGlobalModal}
              className={`px-4 py-2 rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 text-sm sm:text-base transition-colors ${
                modal.type === 'success'
                  ? 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500'
                  : 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500'
              }`}
            >
              {modal.type === 'success' ? 'Entendido' : 'Entendido'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
