import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ApiService } from './apiService';
import type { ApiConfig, WalletBalance, Network, Chain, NetworkConfig, ConfigValidation, ProxyRouterConfig } from './types';
import { getNetworkConfig, CHAINS } from './constants';

interface ApiContextType {
  apiService: ApiService | null;
  isConfigured: boolean;
  walletBalance: WalletBalance | null;
  network: Network | null;
  chain: Chain | null;
  configValidation: ConfigValidation | null;
  configure: (config: { baseUrl: string; username: string; password: string }) => Promise<boolean>;
  refreshWallet: () => Promise<void>;
  clearConfig: () => void;
  getNetworkConfig: () => NetworkConfig | null;
}

/**
 * Auto-detect chain and network from proxy router configuration
 * Returns the matching chain/network combination or null if not recognized
 */

const ApiContext = createContext<ApiContextType | undefined>(undefined);

const STORAGE_KEY = 'morpheus_provider_dashboard_config';

export function ApiProvider({ children }: { children: ReactNode }) {
  const [apiService, setApiService] = useState<ApiService | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null);
  const [network, setNetwork] = useState<Network | null>(null);
  const [chain, setChain] = useState<Chain | null>(null);
  const [configValidation, setConfigValidation] = useState<ConfigValidation | null>(null);

  // Load configuration from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const config: ApiConfig = JSON.parse(stored);
        const service = new ApiService(config.baseUrl, config.username, config.password);
        setApiService(service);
        setNetwork(config.network);
        setChain(config.chain || 'arbitrum'); // Default to arbitrum for backwards compatibility
        setIsConfigured(true);
        
        // Try to load wallet balance
        service.getBalance().then(setWalletBalance).catch(console.error);
      } catch (error) {
        console.error('Failed to restore API configuration:', error);
        sessionStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const configure = async (config: Omit<ApiConfig, 'chain' | 'network'>): Promise<boolean> => {
    const service = new ApiService(config.baseUrl, config.username, config.password);
    
    // Step 1: Test connection and credentials
    try {
      const isHealthy = await service.healthCheck();
      if (!isHealthy) {
        throw new Error('HEALTHCHECK_FAILED');
      }
    } catch (error) {
      console.error('[ApiContext] Health check failed:', error);
      throw new Error('HEALTHCHECK_FAILED');
    }

    // Step 2: Get proxy router configuration and auto-detect chain/network
    let proxyConfig;
    try {
      console.log('[ApiContext] Fetching proxy router configuration...');
      proxyConfig = await service.getConfig();
      console.log('[ApiContext] Config received:', proxyConfig);
    } catch (error) {
      console.error('[ApiContext] Failed to get config:', error);
      throw new Error('CONFIG_FETCH_FAILED');
    }

    // Step 3: Auto-detect chain and network from config
    console.log('[ApiContext] Auto-detecting chain/network from node config...');
    const detectedChainId = proxyConfig.DerivedConfig.ChainID.toString();
    const detectedDiamond = proxyConfig.Config.Marketplace.DiamondContractAddress.toLowerCase();
    
    let detectedChain: Chain | null = null;
    let detectedNetwork: Network | null = null;
    
    // Check all chain/network combinations to find a match
    for (const [chainKey, chainConfig] of Object.entries(CHAINS)) {
      for (const [networkKey, networkConfig] of Object.entries(chainConfig)) {
        if (networkKey === 'name') continue; // Skip the name property
        
        const netConfig = networkConfig as NetworkConfig;
        if (netConfig.chainId === detectedChainId && 
            netConfig.diamondContract.toLowerCase() === detectedDiamond) {
          detectedChain = chainKey as Chain;
          detectedNetwork = networkKey as Network;
          console.log(`[ApiContext] Detected ${chainKey} ${networkKey}`);
          break;
        }
      }
      if (detectedChain) break;
    }
    
    if (!detectedChain || !detectedNetwork) {
      console.warn('[ApiContext] Could not auto-detect chain/network');
      console.warn('[ApiContext] Chain ID:', detectedChainId);
      console.warn('[ApiContext] Diamond:', detectedDiamond);
      throw new Error('CHAIN_NOT_RECOGNIZED');
    }

    // Step 4: Create validation info
    const validation: ConfigValidation = {
      isValid: true,
      errors: [],
      warnings: [],
      actualConfig: {
        chainId: proxyConfig.DerivedConfig.ChainID,
        diamondContract: detectedDiamond,
        morTokenContract: proxyConfig.Config.Marketplace.MorTokenAddress.toLowerCase(),
        Version: proxyConfig.Version,
      },
    };

    // Step 5: Get wallet balance
    let balance;
    try {
      console.log('[ApiContext] Getting wallet balance...');
      balance = await service.getBalance();
      console.log('[ApiContext] Wallet balance received:', balance);
    } catch (error) {
      console.error('[ApiContext] Failed to get balance:', error);
      throw new Error('AUTH_FAILED');
    }
    
    // Step 6: Save successful configuration with auto-detected values
    const fullConfig: ApiConfig = {
      ...config,
      chain: detectedChain,
      network: detectedNetwork,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fullConfig));
    
    setApiService(service);
    setWalletBalance(balance);
    setNetwork(detectedNetwork);
    setChain(detectedChain);
    setConfigValidation(validation);
    setIsConfigured(true);
    
    return true;
  };

  const refreshWallet = async () => {
    if (!apiService) return;
    try {
      const balance = await apiService.getBalance();
      setWalletBalance(balance);
    } catch (error) {
      console.error('Failed to refresh wallet:', error);
    }
  };

  const clearConfig = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setApiService(null);
    setWalletBalance(null);
    setNetwork(null);
    setChain(null);
    setConfigValidation(null);
    setIsConfigured(false);
  };

  const getNetworkConfigHelper = (): NetworkConfig | null => {
    if (!network || !chain) return null;
    return getNetworkConfig(chain, network);
  };

  return (
    <ApiContext.Provider
      value={{
        apiService,
        isConfigured,
        walletBalance,
        network,
        chain,
        configValidation,
        configure,
        refreshWallet,
        clearConfig,
        getNetworkConfig: getNetworkConfigHelper,
      }}
    >
      {children}
    </ApiContext.Provider>
  );
}

export function useApi() {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApi must be used within ApiProvider');
  }
  return context;
}

