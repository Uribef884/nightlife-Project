// nightlife-frontend/src/components/common/ShareButton.tsx
"use client";

import { useState } from 'react';
import { Share2, Copy, Check, MessageSquare } from 'lucide-react';
import { 
  ShareOptions, 
  shareToWhatsApp, 
  shareToSMS,
  copyUrlToClipboard,
  nativeShare 
} from '@/utils/share';

interface ShareButtonProps {
  options: ShareOptions;
  variant?: 'icon' | 'button' | 'button-light' | 'button-gray' | 'text';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showLabel?: boolean;
}

export function ShareButton({ 
  options, 
  variant = 'icon', 
  size = 'md', 
  className = '',
  showLabel = false 
}: ShareButtonProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleNativeShare = async () => {
    const success = await nativeShare(options);
    if (success) {
      setShowDropdown(false);
    } else {
      // Fallback to dropdown if native share fails
      setShowDropdown(true);
    }
  };

  const handleCopy = async () => {
    const success = await copyUrlToClipboard(options);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      setShowDropdown(false);
    }
  };

  const handleWhatsApp = () => {
    shareToWhatsApp(options);
    setShowDropdown(false);
  };

  const handleSMS = () => {
    shareToSMS(options);
    setShowDropdown(false);
  };

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const iconSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  const baseClasses = `
    relative inline-flex items-center justify-center gap-2 rounded-lg transition-colors
    ${sizeClasses[size]}
    ${textSizeClasses[size]}
  `;

  const variantClasses = {
    icon: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
    button: 'bg-purple-600 text-white hover:bg-purple-700',
    'button-light': 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800',
    'button-gray': 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
    text: 'text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300'
  };

  const buttonContent = (
    <>
      <Share2 className={iconSizeClasses[size]} />
      {showLabel && variant !== 'icon' && (
        <span>Compartir</span>
      )}
    </>
  );

  return (
    <div className="relative">
      <button
        onClick={handleNativeShare}
        className={`${baseClasses} ${variantClasses[variant]} ${className}`}
        title="Compartir"
      >
        {buttonContent}
      </button>

      {showDropdown && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowDropdown(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 z-50 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2">
            <button
              onClick={handleWhatsApp}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
            >
              <svg className="w-4 h-4 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.893 3.488"/>
              </svg>
              WhatsApp
            </button>
            
            <button
              onClick={handleSMS}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
            >
              <MessageSquare className="w-4 h-4 text-blue-600" />
              SMS
            </button>
            
            <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
            
            <button
              onClick={handleCopy}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-600" />
                  ¡Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copiar enlace
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
