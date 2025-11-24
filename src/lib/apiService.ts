/**
 * API Service for Proxy Router Backend
 * Handles all API calls to the Morpheus Proxy Router
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  Provider,
  Model,
  Bid,
  WalletBalance,
  ProvidersResponse,
  ModelsResponse,
  BidsResponse,
  CreateProviderRequest,
  CreateModelRequest,
  CreateBidRequest,
  ApproveRequest,
  ProxyRouterConfig,
  LocalModelsResponse,
  ProviderStatus,
} from './types';

export class ApiService {
  private client: AxiosInstance;
  private authToken: string;

  constructor(baseUrl: string, username: string, password: string) {
    this.authToken = btoa(`${username}:${password}`);
    
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Basic ${this.authToken}`,
      },
    });

    // Response interceptor for error logging
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          console.error(`[API] ✗ ${error.response.status} ${error.config?.method?.toUpperCase()} ${error.config?.url}`);
          console.error(`[API] Error Response:`, error.response.data);
          console.error(`[API] Auth Header:`, error.config?.headers?.Authorization ? 'Present (Basic ...)' : 'MISSING');
        } else {
          console.error(`[API] Network Error:`, error.message);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Test API connection by fetching healthcheck
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/healthcheck');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get proxy router configuration
   * Returns chain ID, contract addresses, and other config details
   */
  async getConfig(): Promise<ProxyRouterConfig> {
    console.log('[API] Fetching proxy router config...');
    try {
      const response = await this.client.get<ProxyRouterConfig>('/config');
      console.log('[API] Config response:', response.data);
      return response.data;
    } catch (error) {
      console.error('[API] getConfig failed:', error);
      throw error;
    }
  }

  /**
   * Get wallet address and balance
   * Uses two endpoints:
   * - /wallet - returns { "address": "0x..." }
   * - /blockchain/balance - returns { "mor": "balance", "eth": "balance" }
   */
  async getBalance(): Promise<WalletBalance> {
    console.log('[API] Fetching wallet info...');
    try {
      // Get wallet address from /wallet endpoint
      const walletResponse = await this.client.get('/wallet');
      console.log('[API] Wallet response:', walletResponse.data);
      const address = walletResponse.data.address || '';
      
      // Get balance from /blockchain/balance endpoint
      const balanceResponse = await this.client.get('/blockchain/balance');
      console.log('[API] Balance response:', balanceResponse.data);
      const morBalance = balanceResponse.data.mor || '0';
      const ethBalance = balanceResponse.data.eth || '0';
      
      console.log('[API] ✓ Wallet:', address, 'MOR:', morBalance, 'ETH:', ethBalance);
      
      return {
        address: address,
        balance: morBalance,
        ethBalance: ethBalance,
      };
    } catch (error) {
      console.error('[API] getBalance failed:', error);
      throw error;
    }
  }

  /**
   * Get allowance for a spender (e.g., Diamond contract)
   * Returns the amount in wei that the spender can spend on behalf of the wallet
   */
  async getAllowance(spender: string): Promise<string> {
    console.log('[API] Fetching allowance for spender:', spender);
    const response = await this.client.get('/blockchain/allowance', {
      params: { spender }
    });
    console.log('[API] Allowance response:', response.data);
    return response.data.allowance || '0';
  }

  /**
   * Get all providers from blockchain
   */
  async getProviders(): Promise<Provider[]> {
    const response = await this.client.get<ProvidersResponse>('/blockchain/providers');
    return response.data.providers || [];
  }

  /**
   * Create or update provider
   */
  async createProvider(data: CreateProviderRequest): Promise<Provider> {
    const response = await this.client.post('/blockchain/providers', data);
    return response.data.provider;
  }

  /**
   * Delete provider by address
   */
  async deleteProvider(providerAddress: string): Promise<{ tx: string }> {
    const response = await this.client.delete(`/blockchain/providers/${providerAddress}`);
    return response.data;
  }

  /**
   * Get all models from blockchain
   */
  async getModels(): Promise<Model[]> {
    const response = await this.client.get<ModelsResponse>('/blockchain/models');
    return response.data.models || [];
  }

  /**
   * Create model
   */
  async createModel(data: CreateModelRequest): Promise<Model> {
    const response = await this.client.post('/blockchain/models', data);
    return response.data.model;
  }

  /**
   * Delete model by ID
   */
  async deleteModel(modelId: string): Promise<void> {
    await this.client.delete(`/blockchain/models/${modelId}`);
  }

  /**
   * Delete bid by ID
   */
  async deleteBid(bidId: string): Promise<void> {
    await this.client.delete(`/blockchain/bids/${bidId}`);
  }

  /**
   * Get ACTIVE bids from blockchain for the current wallet/provider
   * Only returns bids with DeletedAt = "0" (active bids)
   */
  async getBids(): Promise<Bid[]> {
    // First get the wallet address
    const walletResponse = await this.client.get('/wallet');
    const address = walletResponse.data.address;
    
    // Get ACTIVE bids for this provider only
    const response = await this.client.get<BidsResponse>(`/blockchain/providers/${address}/bids/active`);
    return response.data.bids || [];
  }

  /**
   * Create bid
   */
  async createBid(data: CreateBidRequest): Promise<Bid> {
    const response = await this.client.post('/blockchain/bids', data);
    return response.data.bid;
  }

  /**
   * Approve spending on Diamond contract
   * Returns transaction details
   */
  async approve(spender: string, amount: string): Promise<any> {
    console.log('[API] Approving spender:', spender, 'Amount:', amount);
    const response = await this.client.post(
      `/blockchain/approve?spender=${spender}&amount=${amount}`
    );
    console.log('[API] Approval response:', response.data);
    return response.data.transaction || response.data;
  }

  /**
   * Get locally configured models from the proxy router
   * This endpoint shows what models the node THINKS it's serving
   */
  async getLocalModels(): Promise<LocalModelsResponse> {
    try {
      const response = await this.client.get<LocalModelsResponse>('/v1/models');
      return response.data;
    } catch (error) {
      console.error('[API] getLocalModels failed:', error);
      throw error;
    }
  }

  /**
   * Get provider status for the current wallet
   * Checks if the wallet is registered as a provider
   */
  async getProviderStatus(): Promise<ProviderStatus> {
    console.log('[API] Checking provider status...');
    try {
      // Get wallet address
      const walletResponse = await this.client.get('/wallet');
      const address = walletResponse.data.address;

      // Get all providers
      const providersResponse = await this.client.get<ProvidersResponse>('/blockchain/providers');
      const providers = providersResponse.data.providers || [];

      // Find provider matching this wallet
      const provider = providers.find(
        (p) => p.Address.toLowerCase() === address.toLowerCase() && !p.IsDeleted
      );

      if (!provider) {
        return {
          isRegistered: false,
          hasEndpoint: false,
        };
      }

      return {
        isRegistered: true,
        provider: provider,
        hasEndpoint: !!provider.Endpoint,
      };
    } catch (error) {
      console.error('[API] getProviderStatus failed:', error);
      throw error;
    }
  }

  /**
   * Check if a provider endpoint is reachable
   * Uses portchecker.io to verify the port is open (same as proxy-router's CheckPortOpen)
   * Note: May fail with CORS error when testing locally. Works fine when deployed to production domain.
   */
  async checkEndpointReachability(endpoint: string): Promise<boolean> {
    console.log('[API] Checking endpoint reachability:', endpoint);
    
    try {
      // Parse host and port from endpoint (format: host:port)
      const parts = endpoint.split(':');
      if (parts.length !== 2) {
        console.error('[API] Invalid endpoint format, expected host:port');
        throw new Error('Invalid endpoint format. Expected: hostname:port or ip:port');
      }

      const host = parts[0];
      const port = parseInt(parts[1], 10);

      if (isNaN(port) || port < 1 || port > 65535) {
        console.error('[API] Invalid port number');
        throw new Error('Invalid port number. Must be between 1 and 65535');
      }

      console.log('[API] Checking port', port, 'on host', host);

      // Use portchecker.io API (same as proxy-router uses)
      const response = await fetch('https://portchecker.io/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          host: host,
          ports: [port],
        }),
      });

      if (!response.ok) {
        console.error('[API] Port checker returned status', response.status);
        const text = await response.text();
        console.error('[API] Port checker error response:', text);
        throw new Error(`Port checker service returned status ${response.status}`);
      }

      // Try to parse JSON response
      let data;
      const responseText = await response.text();
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[API] Failed to parse port checker response as JSON:', responseText);
        throw new Error('Port checker returned invalid response. The service may be unavailable or rate limiting requests.');
      }
      console.log('[API] Port checker full response:', JSON.stringify(data, null, 2));

      // Case 1: API validation error (e.g., hostname doesn't resolve)
      if (data.error === true) {
        let errorMsg = 'Port checker error';
        if (data.extra && data.extra.length > 0) {
          errorMsg = data.extra[0].message || errorMsg;
        } else if (data.detail) {
          errorMsg = data.detail;
        }
        console.error('[API] Port checker validation error:', errorMsg);
        throw new Error(errorMsg);
      }

      // Case 2 & 3: Check if port is open
      if (data.check && data.check.length > 0) {
        const portCheck = data.check[0];
        console.log('[API] Port check result:', portCheck);
        
        if (portCheck.status === true) {
          console.log('[API] ✓ Port is OPEN and reachable');
          return true;
        } else {
          console.log('[API] ✗ Port is CLOSED or unreachable');
          return false;
        }
      }

      console.error('[API] Unexpected response format from port checker');
      throw new Error('Unexpected response from port checker');
    } catch (error) {
      console.error('[API] Error checking endpoint:', error);
      
      // If CORS error, provide helpful message
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error('CORS error: Port checker blocked by browser. This works in production but fails in local dev. You can skip this check or test manually with: curl -X POST https://portchecker.io/api/query -H "Content-Type: application/json" -d \'{"host":"' + endpoint.split(':')[0] + '","ports":[' + endpoint.split(':')[1] + ']}\'');
      }
      
      // Re-throw the error so the component can show the specific error message
      throw error;
    }
  }

  /**
   * Parse API errors for user-friendly messages
   */
  static parseError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.data) {
        const data = axiosError.response.data as any;
        return data.error || data.message || 'API request failed';
      }
      if (axiosError.message) {
        return axiosError.message;
      }
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'An unknown error occurred';
  }
}

