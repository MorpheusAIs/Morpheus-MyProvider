/**
 * Bid price helpers: UI uses MOR/hour; chain uses wei/sec.
 * 1 MOR = 1e18 wei; 1 hour = 3600 seconds.
 */

const WEI_PER_MOR = BigInt('1000000000000000000');
const SECONDS_PER_HOUR = BigInt(3600);
const SCALE = BigInt(1_000_000_000);

/** Convert MOR/hour (UI) → wei/sec (on-chain bid price). */
export function morPerHourToWeiPerSec(morPerHour: number): string {
  if (!Number.isFinite(morPerHour) || morPerHour < 0) return '0';
  // Scale by 1e9 first so fractional MOR/hr survives BigInt math
  const scaled = BigInt(Math.round(morPerHour * 1e9));
  const weiPerSec = (scaled * WEI_PER_MOR) / (SECONDS_PER_HOUR * SCALE);
  return weiPerSec.toString();
}

/** Convert wei/sec → MOR/hour for display. */
export function weiPerSecToMorPerHour(weiPerSec: string): number {
  try {
    const wei = BigInt(weiPerSec || '0');
    // MOR/hr = wei/sec * 3600 / 1e18
    return Number((wei * SECONDS_PER_HOUR * SCALE) / WEI_PER_MOR) / 1e9;
  } catch {
    return 0;
  }
}

/** Round for display inputs */
export function formatMorPerHourInput(morHr: number, digits = 6): string {
  if (!Number.isFinite(morHr)) return '0';
  const s = morHr.toFixed(digits);
  return s.replace(/\.?0+$/, '') || '0';
}
