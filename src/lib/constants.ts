/**
 * Network configurations for Mainnet and Testnet across different chains
 */

import type { ChainConfig } from './types';

export const CHAINS: Record<'arbitrum' | 'base', ChainConfig> = {
  arbitrum: {
    name: 'Arbitrum',
    mainnet: {
      name: 'Arbitrum Mainnet',
      apiUrl: 'http://your-mainnet-provider.domain.io:8082',
      diamondContract: '0xDE819AaEE474626E3f34Ef0263373357e5a6C71b',
      morTokenContract: '0x092bAaDB7DEf4C3981454dD9c0A0D7FF07bCFc86',
      chainId: '42161',
      blockscoutApiUrl: 'https://arbitrum.blockscout.com/api',
    },
    testnet: {
      name: 'Arbitrum Sepolia',
      apiUrl: 'http://your-testnet-provider.domain.io:8082',
      diamondContract: '0xb8C55cD613af947E73E262F0d3C54b7211Af16CF',
      morTokenContract: '0x34a285a1b1c166420df5b6630132542923b5b27e',
      chainId: '421614',
      blockscoutApiUrl: 'https://arbitrum-sepolia.blockscout.com/api',
    },
  },
  base: {
    name: 'Base',
    mainnet: {
      name: 'Base Mainnet',
      apiUrl: 'http://your-mainnet-provider.domain.io:8082',
      diamondContract: '0x6aBE1d282f72B474E54527D93b979A4f64d3030a',
      morTokenContract: '0x7431aDa8a591C955a994a21710752EF9b882b8e3',
      chainId: '8453',
      blockscoutApiUrl: 'https://base.blockscout.com/api',
    },
    testnet: {
      name: 'Base Sepolia',
      apiUrl: 'http://your-testnet-provider.domain.io:8082',
      diamondContract: '0xA328196f2438DADA5ab729E39388D86896c27c85',
      morTokenContract: '0x5C80Ddd187054E1E4aBBfFCD750498e81d34FfA3',
      chainId: '84532',
      blockscoutApiUrl: 'https://base-sepolia.blockscout.com/api',
    },
  },
};

// Helper function to get network config for a specific chain and network
export function getNetworkConfig(chain: 'arbitrum' | 'base', network: 'mainnet' | 'testnet') {
  return CHAINS[chain][network];
}


export const CONTRACT_MINIMUMS = {
  PROVIDER_MIN_STAKE: '200000000000000000', // 0.2 MOR — provider stake
  MODEL_MIN_STAKE: '100000000000000000', // 0.1 MOR — model stake (only when minting)
  /** Non-refundable fee charged on every postModelBid (BASE mainnet / Sepolia docs: 0.3 MOR). */
  MARKETPLACE_BID_FEE_WEI: '300000000000000000', // 0.3 MOR
  /** Model registration fee field on createModel (not the bid fee). Keep small; swagger examples use ~1e11–3e11. */
  MODEL_REGISTRATION_FEE_WEI: '1',
  /**
   * Base mainnet bid floor (wei/sec). Base Sepolia is higher — bid forms read
   * getMinMaxBidPricePerSecond via bidPriceBounds.ts and only fall back here.
   */
  BID_PRICE_PER_SEC_MIN: '10000000000',
};

export const EXTERNAL_LINKS = {
  activeStatus: 'https://active.mor.org/status',
  myProvider: 'https://myprovider.mor.org',
  nodedocsSecretVm: 'https://nodedocs.mor.org/providers/full/secretvm-quickstart',
  nodedocsRegister: 'https://nodedocs.mor.org/providers/full/register-onchain',
  nodedocsVenice: 'https://nodedocs.mor.org/providers/resale/reselling-venice',
  nodedocsProvider: 'https://nodedocs.mor.org/get-started/quickstart-provider',
  secretVmPortal: 'https://secretai.scrtlabs.com/secret-vms/create',
  releases: 'https://github.com/MorpheusAIs/Morpheus-Lumerin-Node/releases',
  techMor: 'https://tech.mor.org',
};

