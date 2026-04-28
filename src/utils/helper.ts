import crypto from 'crypto';

/**
 * Generate a secure temporary password
 * @param length - Password length (default: 12)
 * @returns A secure temporary password
 */
export const generateTempPassword = (length: number = 12): string => {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = '@$!%*?&';
  
  // Ensure password has at least one of each required character type
  let password = '';
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Fill remaining length with random characters from all sets
  const allChars = lowercase + uppercase + numbers + special;
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password to avoid predictable patterns
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

/**
 * Generate a readable temporary password (easier for users to type)
 * Format: Word-Word-Number (e.g., "Happy-Cloud-42")
 * @returns A memorable temporary password
 */
export const generateReadableTempPassword = (): string => {
  const adjectives = [
    'Happy', 'Bright', 'Swift', 'Bold', 'Calm', 'Quick', 'Safe', 'Smart',
    'Strong', 'Wise', 'Clear', 'Cool', 'Fast', 'Free', 'Great', 'Kind'
  ];
  
  const nouns = [
    'Tiger', 'Eagle', 'River', 'Mountain', 'Ocean', 'Forest', 'Cloud', 'Star',
    'Phoenix', 'Dragon', 'Thunder', 'Lightning', 'Falcon', 'Wolf', 'Bear', 'Lion'
  ];
  
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 100);
  const special = ['!', '@', '#', '$'][Math.floor(Math.random() * 4)];
  
  return `${adjective}-${noun}-${number}${special}`;
};

/**
 * Generate a random reference ID
 * @param prefix - Prefix for the reference (e.g., 'QR', 'PAY', 'TRK')
 * @returns A unique reference ID (e.g., QR-20250109-ABC123)
 */
export const generateReferenceId = (prefix: string): string => {
  // const date = new Date();
  // const year = date.getFullYear();
  // const month = String(date.getMonth() + 1).padStart(2, '0');
  // const day = String(date.getDate()).padStart(2, '0');
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  // -${year}${month}${day}
  return `${prefix}-${random}`;
};

/**
 * Generate a secure token for various purposes
 * @param length - Token length in bytes (default: 32)
 * @returns A secure random token
 */
export const generateSecureToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Hash a token using SHA256
 * @param token - Token to hash
 * @returns Hashed token
 */
export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Format currency
 * @param amount - Amount to format
 * @param currency - Currency code (default: 'USD')
 * @returns Formatted currency string
 */
export const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

/**
 * Calculate estimated delivery date
 * @param transitDays - Number of transit days
 * @returns Estimated delivery date
 */
export const calculateDeliveryDate = (transitDays: number): Date => {
  const deliveryDate = new Date();
  deliveryDate.setDate(deliveryDate.getDate() + transitDays);
  return deliveryDate;
};