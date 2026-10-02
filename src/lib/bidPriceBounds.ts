/**
 * On-chain bid price floor/ceiling from Marketplace.getMinMaxBidPricePerSecond.
 * The hardcoded BID_PRICE_PER_SEC_MIN is the Base mainnet floor. Base Sepolia
 * is higher, so bid forms must read the diamond the node is connected to.
 */

import { useEffect, useState } from 'react';
import { useApi } from './ApiContext';
import { CONTRACT_MINIMUMS, getNetworkConfig } from './constants';
import type { Chain, Network } from './types';

/** Solidity: function getMinMaxBidPricePerSecond() view returns (uint256, uint256) */
const GET_MIN_MAX_SELECTOR = '0x38c8ac62';

const PUBLIC_RPC: Partial<Record<`${Chain}-${Network}`, string>> = {
  'base-mainnet': 'https://base.publicnode.com',
  'base-testnet': 'https://base-sepolia.publicnode.com',
};

/**
 * Snapshot used when the eth_call has not returned yet, or the RPC is down.
 * Read 2026-10-02 from the diamonds in constants.ts.
 */
const SNAPSHOT: Partial<Record<`${Chain}-${Network}`, { minWei: string; maxWei: string }>> = {
  'base-mainnet': { minWei: '10000000000', maxWei: '10000000000000000' },
  'base-testnet': { minWei: '121052630917', maxWei: '20000000000000000000' },
};

export interface BidPriceBounds {
  minWei: string;
  maxWei: string | null;
  source: 'chain' | 'fallback';
}

export function decodeMinMaxBidPrice(hex: string): { minWei: string; maxWei: string } {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (h.length < 128 || !/^[0-9a-fA-F]+$/.test(h)) {
    throw new Error('unexpected getMinMaxBidPricePerSecond result');
  }
  return {
    minWei: BigInt('0x' + h.slice(0, 64)).toString(),
    maxWei: BigInt('0x' + h.slice(64, 128)).toString(),
  };
}

export function fallbackBidPriceBounds(chain: Chain | null, network: Network | null): BidPriceBounds {
  const key = chain && network ? (`${chain}-${network}` as const) : null;
  const snap = key ? SNAPSHOT[key] : undefined;
  if (snap) return { ...snap, source: 'fallback' };
  return {
    minWei: CONTRACT_MINIMUMS.BID_PRICE_PER_SEC_MIN,
    maxWei: null,
    source: 'fallback',
  };
}

export async function fetchBidPriceBounds(
  chain: Chain,
  network: Network,
  signal?: AbortSignal
): Promise<BidPriceBounds | null> {
  const rpc = PUBLIC_RPC[`${chain}-${network}`];
  if (!rpc) return null;
  const diamond = getNetworkConfig(chain, network).diamondContract;
  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to: diamond, data: GET_MIN_MAX_SELECTOR }, 'latest'],
    }),
    signal,
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { result?: string };
  if (typeof body.result !== 'string') return null;
  return { ...decodeMinMaxBidPrice(body.result), source: 'chain' };
}

/** null when wei is inside the inclusive on-chain range. */
export function bidPriceRangeError(wei: string, bounds: BidPriceBounds): string | null {
  let price: bigint;
  try {
    if (!/^\d+$/.test(wei)) return 'Enter a whole-number wei/sec price';
    price = BigInt(wei);
  } catch {
    return 'Enter a whole-number wei/sec price';
  }
  const min = BigInt(bounds.minWei);
  if (price < min) {
    return `Minimum is ${bounds.minWei} wei/sec`;
  }
  if (bounds.maxWei) {
    const max = BigInt(bounds.maxWei);
    if (price > max) return `Maximum is ${bounds.maxWei} wei/sec`;
  }
  return null;
}

export function useBidPriceBounds(): BidPriceBounds {
  const { chain, network } = useApi();
  const [bounds, setBounds] = useState<BidPriceBounds>(() => fallbackBidPriceBounds(chain, network));

  useEffect(() => {
    const fb = fallbackBidPriceBounds(chain, network);
    setBounds(fb);
    if (!chain || !network) return;
    const ac = new AbortController();
    fetchBidPriceBounds(chain, network, ac.signal)
      .then((live) => {
        if (live) setBounds(live);
      })
      .catch(() => {
        /* keep the snapshot fallback */
      });
    return () => ac.abort();
  }, [chain, network]);

  return bounds;
}
