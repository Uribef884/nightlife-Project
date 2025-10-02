// nightlife-frontend/src/components/common/ShareButton.tsx
"use client";

import { useState } from 'react';
import { Share2, MessageCircle, Facebook, Twitter, Copy, Check } from 'lucide-react';
import { 
  ShareOptions, 
  shareToWhatsApp, 
  shareToFacebook, 
  shareToTwitter, 
  copyToClipboard,
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
    const success = await copyToClipboard(options);
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

  const handleFacebook = () => {
    shareToFacebook(options);
    setShowDropdown(false);
  };

  const handleTwitter = () => {
    shareToTwitter(options);
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
              <MessageCircle className="w-4 h-4 text-green-600" />
              WhatsApp
            </button>
            
            <button
              onClick={handleFacebook}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
            >
              <Facebook className="w-4 h-4 text-blue-600" />
              Facebook
            </button>
            
            <button
              onClick={handleTwitter}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
            >
              <Twitter className="w-4 h-4 text-blue-400" />
              Twitter
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
