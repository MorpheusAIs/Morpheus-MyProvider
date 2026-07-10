/**
 * Public marketplace snapshots from active.mor.org (no auth).
 * Prefer bidding on an existing model Id over minting duplicates.
 *
 * Browser note: CloudFront CORS allowlists specific Origins. Local Vite uses
 * `/active-mor` proxy so 127.0.0.1 and localhost both work. Production needs
 * myprovider.mor.org on the active.mor.org CORS list (see Morpheus-Infra).
 */

export const ACTIVE_MOR_ORG = {
  status: 'https://active.mor.org/status',
  activeModels: 'https://active.mor.org/active_models.json',
  activeBids: 'https://active.mor.org/active_bids.json',
  allModels: 'https://active.mor.org/all_models.json',
} as const;

function activeMorUrl(path: string): string {
  // Dev: Vite proxy avoids CORS mismatches (localhost vs 127.0.0.1).
  if (import.meta.env.DEV) {
    return `/active-mor${path.startsWith('/') ? path : `/${path}`}`;
  }
  return `https://active.mor.org${path.startsWith('/') ? path : `/${path}`}`;
}

export interface ActiveBidDetail {
  bidId: string;
  providerId: string;
  pricePerSecond: string;
  priceMorPerHour?: number;
  status?: string;
}

export interface ActiveModel {
  Id: string;
  IpfsCID?: string;
  Name: string;
  Tags?: string[];
  Owner?: string;
  ModelType?: string;
  health?: {
    status?: string;
    healthyBids?: number;
    providers?: number;
  };
  bidDetail?: ActiveBidDetail[];
}

export interface ActiveBid {
  Id: string;
  Provider: string;
  ModelAgentId: string;
  PricePerSecond: string;
  ModelName: string;
  health?: {
    status?: string;
    latencyMs?: number | null;
  };
}

let modelsCache: { at: number; data: ActiveModel[] } | null = null;
let bidsCache: { at: number; data: ActiveBid[] } | null = null;
const CACHE_MS = 60_000;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`active.mor.org ${res.status}: ${url}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchActiveModels(force = false): Promise<ActiveModel[]> {
  if (!force && modelsCache && Date.now() - modelsCache.at < CACHE_MS) {
    return modelsCache.data;
  }
  const body = await fetchJson<{ models: ActiveModel[] }>(activeMorUrl('/active_models.json'));
  const data = body.models || [];
  modelsCache = { at: Date.now(), data };
  return data;
}

export async function fetchActiveBids(force = false): Promise<ActiveBid[]> {
  if (!force && bidsCache && Date.now() - bidsCache.at < CACHE_MS) {
    return bidsCache.data;
  }
  const body = await fetchJson<{ bids: ActiveBid[] }>(activeMorUrl('/active_bids.json'));
  const data = body.bids || [];
  bidsCache = { at: Date.now(), data };
  return data;
}

export function findModelsByName(query: string, models: ActiveModel[]): ActiveModel[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return models
    .filter((m) => m.Name?.toLowerCase().includes(q))
    .sort((a, b) => a.Name.localeCompare(b.Name))
    .slice(0, 25);
}

export function getCompetingBids(modelName: string, bids: ActiveBid[]): ActiveBid[] {
  const q = modelName.trim().toLowerCase();
  return bids
    .filter((b) => b.ModelName?.toLowerCase() === q || b.ModelName?.toLowerCase().includes(q))
    .sort((a, b) => BigInt(a.PricePerSecond) < BigInt(b.PricePerSecond) ? -1 : 1);
}

export function lowestPricePerSecond(model: ActiveModel): string | null {
  const prices = (model.bidDetail || [])
    .map((b) => b.pricePerSecond)
    .filter(Boolean);
  if (!prices.length) return null;
  return prices.reduce((min, p) => (BigInt(p) < BigInt(min) ? p : min));
}

export function weiPerSecToMorPerHour(weiPerSec: string): number {
  // MOR/hour = wei/sec * 3600 / 1e18
  const wei = Number(weiPerSec);
  if (!Number.isFinite(wei)) return 0;
  return (wei * 3600) / 1e18;
}
