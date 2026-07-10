/**
 * Helpers for suggested bid prices from active.mor.org snapshots.
 */

import { CONTRACT_MINIMUMS } from './constants';
import {
  getCompetingBids,
  lowestPricePerSecond,
  weiPerSecToMorPerHour,
  type ActiveBid,
  type ActiveModel,
} from './activeMorOrg';

export function suggestBidWeiPerSec(model: ActiveModel, allBids: ActiveBid[]): string {
  const fromDetail = lowestPricePerSecond(model);
  if (fromDetail) return fromDetail;
  const comps = getCompetingBids(model.Name, allBids);
  if (comps.length) return comps[0].PricePerSecond;
  return CONTRACT_MINIMUMS.BID_PRICE_PER_SEC_MIN;
}

export function formatBidContext(model: ActiveModel, allBids: ActiveBid[]): {
  lowestWei: string | null;
  lowestMorHr: number | null;
  medianMorHr: number | null;
  bidCount: number;
  sample: { provider: string; morHr: number; wei: string }[];
} {
  const comps = getCompetingBids(model.Name, allBids);
  const fromModel = (model.bidDetail || []).map((b) => ({
    provider: b.providerId,
    wei: b.pricePerSecond,
    morHr: b.priceMorPerHour ?? weiPerSecToMorPerHour(b.pricePerSecond),
  }));
  const fromBids = comps.map((b) => ({
    provider: b.Provider,
    wei: b.PricePerSecond,
    morHr: weiPerSecToMorPerHour(b.PricePerSecond),
  }));
  // Prefer model.bidDetail when present; else active_bids
  const sample = (fromModel.length ? fromModel : fromBids)
    .sort((a, b) => a.morHr - b.morHr)
    .slice(0, 5);
  const lowestWei = sample[0]?.wei ?? lowestPricePerSecond(model);
  const hours = sample.map((s) => s.morHr);
  const medianMorHr =
    hours.length === 0
      ? null
      : hours.length % 2 === 1
        ? hours[(hours.length - 1) / 2]
        : (hours[hours.length / 2 - 1] + hours[hours.length / 2]) / 2;

  return {
    lowestWei,
    lowestMorHr: lowestWei ? weiPerSecToMorPerHour(lowestWei) : null,
    medianMorHr,
    bidCount: Math.max(fromModel.length, comps.length),
    sample,
  };
}

export function morPerHourToWeiPerSec(morHr: number): string {
  // wei/sec = mor/hr * 1e18 / 3600
  const wei = Math.round((morHr * 1e18) / 3600);
  return BigInt(wei).toString();
}
