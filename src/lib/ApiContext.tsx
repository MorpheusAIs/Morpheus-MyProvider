'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ApiService } from './apiService';
import type { ApiConfig, WalletBalance, Network } from './types';
import { NETWORKS } from './constants';

interface ApiContextType {
  apiService: ApiService | null;
  isConfigured: boolean;
  walletBalance: WalletBalance | null;
  network: Network | null;
  configure: (config: ApiConfig) => Promise<boolean>;
  refreshWallet: () => Promise<void>;
  clearConfig: () => void;
  getNetworkConfig: () => { diamondContract: string; morTokenContract: string } | null;
}

const ApiContext = createContext<ApiContextType | undefined>(undefined);

const STORAGE_KEY = 'morpheus_provider_dashboard_config';

export function ApiProvider({ children }: { children: ReactNode }) {
  const [apiService, setApiService] = useState<ApiService | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null);
  const [network, setNetwork] = useState<Network | null>(null);

  // Load configuration from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const config: ApiConfig = JSON.parse(stored);
        const service = new ApiService(config.baseUrl, config.username, config.password);
        setApiService(service);
        setNetwork(config.network);
        setIsConfigured(true);
        
        // Try to load wallet balance
        service.getBalance().then(setWalletBalance).catch(console.error);
      } catch (error) {
        console.error('Failed to restore API configuration:', error);
        sessionStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const configure = async (config: ApiConfig): Promise<boolean> => {
    try {
      const service = new ApiService(config.baseUrl, config.username, config.password);
      
      // Test connection
      const isHealthy = await service.healthCheck();
      if (!isHealthy) {
        throw new Error('API health check failed');
      }

      // Get wallet balance to verify authentication
      const balance = await service.getBalance();
      console.log('[ApiContext] Wallet balance received:', balance);
      
      // Save to sessionStorage
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      
      setApiService(service);
      setWalletBalance(balance);
      setNetwork(config.network);
      setIsConfigured(true);
      
      return true;
    } catch (error) {
      console.error('API configuration failed:', error);
      return false;
    }
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
    setIsConfigured(false);
  };

  const getNetworkConfig = () => {
    if (!network) return null;
    return {
      diamondContract: NETWORKS[network].diamondContract,
      morTokenContract: NETWORKS[network].morTokenContract,
    };
  };

  return (
    <ApiContext.Provider
      value={{
        apiService,
        isConfigured,
        walletBalance,
        network,
        configure,
        refreshWallet,
        clearConfig,
        getNetworkConfig,
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

