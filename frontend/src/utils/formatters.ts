import { MOTE_RATIO, MAX_DISPLAYED_DECIMALS, CSPR_DECIMALS } from './constants';

/**
 * Convert motes to CSPR
 */
export function motesToCspr(motes: bigint | string | number): number {
  const motesValue = typeof motes === 'bigint' ? motes : BigInt(motes);
  return Number(motesValue) / MOTE_RATIO;
}

/**
 * Convert CSPR to motes
 */
export function csprToMotes(cspr: number | string): bigint {
  const csprValue = typeof cspr === 'string' ? parseFloat(cspr) : cspr;
  return BigInt(Math.floor(csprValue * MOTE_RATIO));
}

/**
 * Format CSPR amount with proper decimals
 */
export function formatCspr(
  motes: bigint | string | number,
  decimals: number = MAX_DISPLAYED_DECIMALS
): string {
  const cspr = motesToCspr(motes);
  return cspr.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format percentage with proper decimals
 */
export function formatPercentage(
  value: number,
  decimals: number = 2
): string {
  return `${value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  })}%`;
}

/**
 * Format APY (Annual Percentage Yield)
 */
export function formatApy(apy: number): string {
  return formatPercentage(apy);
}

/**
 * Truncate address for display
 */
export function truncateAddress(
  address: string,
  startLength: number = 6,
  endLength: number = 4
): string {
  if (!address) return '';
  if (address.length <= startLength + endLength) return address;
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
}

/**
 * Format timestamp to readable date
 */
export function formatDate(timestamp: number | Date): string {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format timestamp to readable date and time
 */
export function formatDateTime(timestamp: number | Date): string {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format large numbers with K, M, B suffixes
 */
export function formatCompactNumber(value: number): string {
  const formatter = Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  });
  return formatter.format(value);
}

/**
 * Parse CSPR input to motes (handles user input)
 */
export function parseCsprInput(input: string): bigint | null {
  try {
    const value = parseFloat(input);
    if (isNaN(value) || value < 0) return null;
    return csprToMotes(value);
  } catch {
    return null;
  }
}

/**
 * Validate CSPR amount
 */
export function isValidCsprAmount(amount: string): boolean {
  const parsed = parseCsprInput(amount);
  return parsed !== null && parsed > BigInt(0);
}

/**
 * Format transaction hash for display
 */
export function formatTxHash(hash: string): string {
  return truncateAddress(hash, 8, 6);
}
