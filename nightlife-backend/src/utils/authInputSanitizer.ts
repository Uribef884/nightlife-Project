// src/utils/authInputSanitizer.ts
import { sanitizeInput } from './sanitizeInput';

interface AuthInputValidation {
  isValid: boolean;
  sanitizedValue?: string;
  error?: string;
}

/**
 * Enhanced input sanitizer specifically for authentication forms
 * Protects against XSS, SQL injection, and other attacks
 */
export class AuthInputSanitizer {
  /**
   * Sanitize email input for authentication
   */
  static sanitizeEmail(email: string): AuthInputValidation {
    if (!email || typeof email !== 'string') {
      return { isValid: false, error: 'Email is required' };
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { isValid: false, error: 'Invalid email format' };
    }

    // Sanitize the email
    const sanitized = sanitizeInput(email, {
      escapeHtml: true,
      removeQuotes: false, // Keep quotes for email addresses
      maxLength: 254 // RFC 5321 limit
    });

    if (!sanitized) {
      return { isValid: false, error: 'Email contains invalid characters' };
    }

    // Additional email security checks
    if (sanitized.length > 254) {
      return { isValid: false, error: 'Email is too long' };
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /data:/i,
      /vbscript:/i
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(sanitized)) {
        return { isValid: false, error: 'Email contains suspicious content' };
      }
    }

    return { isValid: true, sanitizedValue: sanitized };
  }

  /**
   * Sanitize password input for authentication
   */
  static sanitizePassword(password: string): AuthInputValidation {
    if (!password || typeof password !== 'string') {
      return { isValid: false, error: 'Password is required' };
    }

    // Password length validation
    if (password.length < 8) {
      return { isValid: false, error: 'Password must be at least 8 characters long' };
    }

    if (password.length > 128) {
      return { isValid: false, error: 'Password is too long' };
    }

    // Check for common weak passwords
    const weakPasswords = [
      'password',
      '123456',
      '123456789',
      'qwerty',
      'abc123',
      'password123',
      'admin',
      'letmein',
      'welcome',
      'monkey'
    ];

    if (weakPasswords.includes(password.toLowerCase())) {
      return { isValid: false, error: 'Password is too common, please choose a stronger password' };
    }

    // Check for password strength
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    const strengthScore = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(Boolean).length;

    if (strengthScore < 3) {
      return { isValid: false, error: 'Password must contain uppercase, lowercase, numbers, and special characters' };
    }

    // Sanitize password (but don't escape HTML since it's not displayed)
    const sanitized = sanitizeInput(password, {
      escapeHtml: false,
      removeQuotes: false,
      maxLength: 128
    });

    if (!sanitized) {
      return { isValid: false, error: 'Password contains invalid characters' };
    }

    return { isValid: true, sanitizedValue: sanitized };
  }

  /**
   * Sanitize name input for registration
   */
  static sanitizeName(name: string): AuthInputValidation {
    if (!name || typeof name !== 'string') {
      return { isValid: false, error: 'Name is required' };
    }

    // Name length validation
    if (name.length < 2) {
      return { isValid: false, error: 'Name must be at least 2 characters long' };
    }

    if (name.length > 50) {
      return { isValid: false, error: 'Name is too long' };
    }

    // Name format validation (letters, spaces, hyphens, apostrophes)
    const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s\-']+$/;
    if (!nameRegex.test(name)) {
      return { isValid: false, error: 'Name can only contain letters, spaces, hyphens, and apostrophes' };
    }

    // Sanitize the name
    const sanitized = sanitizeInput(name, {
      escapeHtml: true,
      removeQuotes: false,
      maxLength: 50
    });

    if (!sanitized) {
      return { isValid: false, error: 'Name contains invalid characters' };
    }

    return { isValid: true, sanitizedValue: sanitized };
  }

  /**
   * Sanitize phone number input
   */
  static sanitizePhoneNumber(phone: string): AuthInputValidation {
    if (!phone || typeof phone !== 'string') {
      return { isValid: false, error: 'Phone number is required' };
    }

    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');

    // Validate length (Colombian phone numbers are 10 digits)
    if (digitsOnly.length !== 10) {
      return { isValid: false, error: 'Phone number must be 10 digits' };
    }

    // Check if it's a valid Colombian phone number
    const colombianPhoneRegex = /^3[0-9]{9}$/;
    if (!colombianPhoneRegex.test(digitsOnly)) {
      return { isValid: false, error: 'Invalid Colombian phone number format' };
    }

    return { isValid: true, sanitizedValue: digitsOnly };
  }

  /**
   * Sanitize search query input
   */
  static sanitizeSearchQuery(query: string): AuthInputValidation {
    if (!query || typeof query !== 'string') {
      return { isValid: false, error: 'Search query is required' };
    }

    // Search query length validation
    if (query.length < 1) {
      return { isValid: false, error: 'Search query cannot be empty' };
    }

    if (query.length > 100) {
      return { isValid: false, error: 'Search query is too long' };
    }

    // Sanitize the query
    const sanitized = sanitizeInput(query, {
      escapeHtml: true,
      removeQuotes: false,
      maxLength: 100
    });

    if (!sanitized) {
      return { isValid: false, error: 'Search query contains invalid characters' };
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /data:/i,
      /vbscript:/i,
      /union\s+select/i,
      /drop\s+table/i,
      /delete\s+from/i,
      /insert\s+into/i,
      /update\s+set/i
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(sanitized)) {
        return { isValid: false, error: 'Search query contains suspicious content' };
      }
    }

    return { isValid: true, sanitizedValue: sanitized };
  }

  /**
   * Sanitize reset token input
   */
  static sanitizeResetToken(token: string): AuthInputValidation {
    if (!token || typeof token !== 'string') {
      return { isValid: false, error: 'Reset token is required' };
    }

    // Token format validation (UUID format)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      return { isValid: false, error: 'Invalid reset token format' };
    }

    return { isValid: true, sanitizedValue: token };
  }
}

/**
 * Utility function to validate multiple auth inputs at once
 */
export function validateAuthInputs(inputs: {
  email?: string;
  password?: string;
  name?: string;
  phone?: string;
  searchQuery?: string;
  resetToken?: string;
}): { isValid: boolean; errors: string[]; sanitized: any } {
  const errors: string[] = [];
  const sanitized: any = {};

  if (inputs.email) {
    const emailResult = AuthInputSanitizer.sanitizeEmail(inputs.email);
    if (!emailResult.isValid) {
      errors.push(emailResult.error!);
    } else {
      sanitized.email = emailResult.sanitizedValue;
    }
  }

  if (inputs.password) {
    const passwordResult = AuthInputSanitizer.sanitizePassword(inputs.password);
    if (!passwordResult.isValid) {
      errors.push(passwordResult.error!);
    } else {
      sanitized.password = passwordResult.sanitizedValue;
    }
  }

  if (inputs.name) {
    const nameResult = AuthInputSanitizer.sanitizeName(inputs.name);
    if (!nameResult.isValid) {
      errors.push(nameResult.error!);
    } else {
      sanitized.name = nameResult.sanitizedValue;
    }
  }

  if (inputs.phone) {
    const phoneResult = AuthInputSanitizer.sanitizePhoneNumber(inputs.phone);
    if (!phoneResult.isValid) {
      errors.push(phoneResult.error!);
    } else {
      sanitized.phone = phoneResult.sanitizedValue;
    }
  }

  if (inputs.searchQuery) {
    const searchResult = AuthInputSanitizer.sanitizeSearchQuery(inputs.searchQuery);
    if (!searchResult.isValid) {
      errors.push(searchResult.error!);
    } else {
      sanitized.searchQuery = searchResult.sanitizedValue;
    }
  }

  if (inputs.resetToken) {
    const tokenResult = AuthInputSanitizer.sanitizeResetToken(inputs.resetToken);
    if (!tokenResult.isValid) {
      errors.push(tokenResult.error!);
    } else {
      sanitized.resetToken = tokenResult.sanitizedValue;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  };
}
