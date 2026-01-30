import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format wei amount to MOR (display format with 8 decimal places)
 */
export function weiToMor(wei: string | number | undefined | null): string {
  if (wei === undefined || wei === null || wei === '') {
    return '0.00000000';
  }
  try {
    const weiNum = typeof wei === 'string' ? BigInt(wei) : BigInt(wei);
    const morNum = Number(weiNum) / 1e18;
    return morNum.toFixed(8);
  } catch (error) {
    console.error('Error converting wei to MOR:', wei, error);
    return '0.00000000';
  }
}

/**
 * Smart format MOR - shows meaningful precision without trailing zeros
 * For larger values (stakes): 0.10000000 -> 0.10
 * For tiny values (bids): 0.000000200001 -> 0.00000020
 * Shows at least 2 significant digits after first non-zero digit
 */
export function formatMor(wei: string | number | undefined | null): string {
  if (wei === undefined || wei === null || wei === '') {
    return '0';
  }
  
  try {
    const weiNum = typeof wei === 'string' ? BigInt(wei) : BigInt(wei);
    const morNum = Number(weiNum) / 1e18;
    
    if (morNum === 0) return '0';
    
    // Convert to string with max precision
    const fullStr = morNum.toFixed(18);
    
    // Find first non-zero digit after decimal point
    const parts = fullStr.split('.');
    if (parts.length === 1) return parts[0]; // No decimal part
    
    const decimalPart = parts[1];
    let firstNonZeroIndex = -1;
    
    for (let i = 0; i < decimalPart.length; i++) {
      if (decimalPart[i] !== '0') {
        firstNonZeroIndex = i;
        break;
      }
    }
    
    if (firstNonZeroIndex === -1) return parts[0]; // All zeros after decimal
    
    // Show at least 2 significant digits after the first non-zero digit
    const endIndex = Math.min(firstNonZeroIndex + 2, decimalPart.length);
    let trimmedDecimal = decimalPart.substring(0, endIndex + 1);
    
    // Remove trailing zeros
    trimmedDecimal = trimmedDecimal.replace(/0+$/, '');
    
    // If we removed everything, keep at least the significant digits
    if (trimmedDecimal.length < endIndex) {
      trimmedDecimal = decimalPart.substring(0, endIndex);
    }
    
    return `${parts[0]}.${trimmedDecimal}`;
  } catch (error) {
    console.error('Error formatting MOR:', wei, error);
    return '0';
  }
}

/**
 * Format wei amount to ETH
 */
export function weiToEth(wei: string | number | undefined | null): string {
  if (wei === undefined || wei === null || wei === '') {
    return '0.000000';
  }
  try {
    const weiNum = typeof wei === 'string' ? BigInt(wei) : BigInt(wei);
    const ethNum = Number(weiNum) / 1e18;
    return ethNum.toFixed(6);
  } catch (error) {
    console.error('Error converting wei to ETH:', wei, error);
    return '0.000000';
  }
}

/**
 * Format MOR amount to wei
 */
export function morToWei(mor: string | number): string {
  const morNum = typeof mor === 'string' ? parseFloat(mor) : mor;
  return (BigInt(Math.floor(morNum * 1e18))).toString();
}

/**
 * Convert GWEI to wei (1 GWEI = 10^9 wei)
 */
export function gweiToWei(gwei: string | number): string {
  const gweiNum = typeof gwei === 'string' ? parseFloat(gwei) : gwei;
  return (BigInt(Math.floor(gweiNum * 1e9))).toString();
}

/**
 * Convert wei to GWEI (1 GWEI = 10^9 wei)
 */
export function weiToGwei(wei: string | number | undefined | null): string {
  if (wei === undefined || wei === null || wei === '') {
    return '0';
  }
  try {
    const weiNum = typeof wei === 'string' ? BigInt(wei) : BigInt(wei);
    const gweiNum = Number(weiNum) / 1e9;
    return gweiNum.toString();
  } catch (error) {
    console.error('Error converting wei to GWEI:', wei, error);
    return '0';
  }
}

/**
 * Convert GWEI to MOR for display (1 GWEI = 10^-9 MOR)
 * Shows smart precision for the MOR equivalent
 */
export function gweiToMor(gwei: string | number | undefined | null): string {
  if (gwei === undefined || gwei === null || gwei === '') {
    return '0';
  }
  try {
    const gweiNum = typeof gwei === 'string' ? parseFloat(gwei) : gwei;
    if (isNaN(gweiNum) || gweiNum <= 0) return '0';
    
    // 1 GWEI = 10^9 wei, 1 MOR = 10^18 wei
    // So 1 GWEI = 10^9 / 10^18 MOR = 10^-9 MOR
    const morNum = gweiNum / 1e9;
    
    if (morNum === 0) return '0';
    
    // Format with appropriate precision
    if (morNum >= 1) {
      return morNum.toFixed(4);
    } else if (morNum >= 0.0001) {
      return morNum.toFixed(6);
    } else {
      // For very small values, show more precision
      const str = morNum.toFixed(18);
      // Remove trailing zeros but keep at least 2 significant digits
      return str.replace(/\.?0+$/, '') || '0';
    }
  } catch (error) {
    console.error('Error converting GWEI to MOR:', gwei, error);
    return '0';
  }
}

/**
 * Shorten address for display
 */
export function shortenAddress(address: string, chars: number = 4): string {
  if (!address) return '';
  if (address.length <= chars * 2 + 2) return address;
  return `${address.substring(0, chars + 2)}...${address.substring(address.length - chars)}`;
}

/**
 * Format timestamp to readable date
 */
export function formatTimestamp(timestamp: string | number): string {
  const ts = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
  const date = new Date(ts * 1000);
  return date.toLocaleString();
}

/**
 * Validate Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate positive number
 */
export function isValidPositiveNumber(value: string): boolean {
  const num = parseFloat(value);
  return !isNaN(num) && num > 0;
}

