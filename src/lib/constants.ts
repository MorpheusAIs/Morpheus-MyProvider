/**
 * Network configurations for Mainnet and Testnet
 */

import type { NetworkConfig } from './types';

export const NETWORKS: Record<'mainnet' | 'testnet', NetworkConfig> = {
  mainnet: {
    name: 'Mainnet',
    apiUrl: 'http://your-mainnet-provider.domain.io:8082', // Configure your mainnet proxy router API URL
    diamondContract: '0xDE819AaEE474626E3f34Ef0263373357e5a6C71b',
    morTokenContract: '0x092bAaDB7DEf4C3981454dD9c0A0D7FF07bCFc86',
  },
  testnet: {
    name: 'Testnet',
    apiUrl: 'http://your-testnet-provider.domain.io:8082', // Configure your testnet proxy router API URL
    diamondContract: '0xb8C55cD613af947E73E262F0d3C54b7211Af16CF',
    morTokenContract: '0x34a285a1b1c166420df5b6630132542923b5b27e',
  },
};


export const CONTRACT_MINIMUMS = {
  PROVIDER_MIN_STAKE: '200000000000000000', // mor-wei
  MODEL_MIN_STAKE: '100000000000000000', // mor-wei
  MARKETPLACE_BID_FEE: '300000000000000000', // mor-wei
  BID_PRICE_PER_SEC_MIN: '10000000000', // mor-wei
};

