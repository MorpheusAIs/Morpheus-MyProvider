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

export interface PortCheckResult {
  isOpen: boolean;
  diagnostics?: {
    hostResolves: boolean;
    resolvedIp?: string;
    hostReachable: boolean;
    message: string;
  };
}

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
   * Explicitly request all models by not specifying limit (defaults to returning all)
   * If pagination is needed in future, implement proper loop with offset/limit
   */
  async getModels(): Promise<Model[]> {
    // Models endpoint: when no params provided, backend returns ALL models
    // Backend has special logic: if (limit == 0) return GetAllModels()
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
   * Uses high limit to fetch all bids (uint8 max = 255)
   */
  async getBids(): Promise<Bid[]> {
    // First get the wallet address
    const walletResponse = await this.client.get('/wallet');
    const address = walletResponse.data.address;
    
    // Get ALL ACTIVE bids for this provider using maximum limit
    // Default is 10 which causes undercounting - use 255 (uint8 max) to get all
    const response = await this.client.get<BidsResponse>(`/blockchain/providers/${address}/bids/active`, {
      params: {
        limit: 255,  // Max uint8 value - should cover all reasonable bid counts
        offset: 0,
        order: 'asc'
      }
    });
    return response.data.bids || [];
  }

  /**
   * Get active bids for a specific model (from all providers)
   * Handles pagination to fetch all bids
   */
  async getBidsForModel(modelId: string): Promise<Bid[]> {
    const BATCH_SIZE = 255; // uint8 max
    const allBids: Bid[] = [];
    let offset = 0;
    
    try {
      while (true) {
        const response = await this.client.get<BidsResponse>(`/blockchain/models/${modelId}/bids/active`, {
          params: {
            limit: BATCH_SIZE,
            offset: offset,
            order: 'asc'
          }
        });
        
        const bids = response.data.bids || [];
        allBids.push(...bids);
        
        // If we got fewer than BATCH_SIZE, we've fetched all bids
        if (bids.length < BATCH_SIZE) {
          break;
        }
        
        offset += BATCH_SIZE;
      }
      
      return allBids;
    } catch (error) {
      console.error(`[API] getBidsForModel failed for ${modelId}:`, error);
      return allBids; // Return whatever we've collected so far
    }
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
   * Check if a TCP port is open and reachable (works for any protocol)
   * 
   * Strategy: Attempt direct connection with 5s timeout
   * - Port OPEN: Gets any response (success, error, CORS, protocol mismatch) = something is listening
   * - Port CLOSED: Connection timeout = runs diagnostics (DNS, host reachability)
   * 
   * Works reliably from browser for HTTP/HTTPS/TCP ports without needing external services
   * 
   * @param endpoint - Format: "hostname:port" or "ip:port" (e.g., "morpheus.example.com:3333")
   * @returns PortCheckResult with diagnostic info if port is closed
   * @throws Error if endpoint format is invalid
   */
  async checkEndpointReachability(endpoint: string): Promise<PortCheckResult> {
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

      // Step 1: Check if hostname or IP address
      const isIpAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
      let resolvedIp = host;

      // Step 2: If it's a hostname, resolve DNS FIRST
      if (!isIpAddress) {
        console.log('[API] Resolving DNS for hostname:', host);
        try {
          const dnsResponse = await fetch(`https://cloudflare-dns.com/dns-query?name=${host}&type=A`, {
            headers: { 'accept': 'application/dns-json' },
            signal: AbortSignal.timeout(3000),
          });
          
          if (dnsResponse.ok) {
            const dnsData = await dnsResponse.json();
            if (dnsData.Answer && dnsData.Answer.length > 0) {
              resolvedIp = dnsData.Answer[0].data;
              console.log('[API] DNS resolved:', host, '→', resolvedIp);
            } else {
              // DNS query succeeded but no A record found
              console.log('[API] DNS lookup returned no A records for', host);
              return {
                isOpen: false,
                diagnostics: {
                  hostResolves: false,
                  hostReachable: false,
                  message: `Invalid hostname: "${host}" does not resolve to an IP address. Check your spelling or use an IP address instead.`,
                },
              };
            }
          } else {
            throw new Error('DNS lookup failed');
          }
        } catch (dnsErr) {
          console.log('[API] DNS lookup failed for', host, ':', dnsErr);
          return {
            isOpen: false,
            diagnostics: {
              hostResolves: false,
              hostReachable: false,
              message: `Invalid hostname: Cannot resolve "${host}". Check your spelling or use an IP address instead.`,
            },
          };
        }
      }

      // Step 3: Now check the port (we have valid IP at this point)
      console.log('[API] Checking port', port, 'on', resolvedIp);
      
      // Check if we're on HTTPS trying to check HTTP (mixed content issue)
      const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const startTime = Date.now();

      try {
        await fetch(`http://${endpoint}/`, {
          method: 'GET',
          signal: controller.signal,
          redirect: 'manual',
          cache: 'no-store',
        });
        
        clearTimeout(timeoutId);
        // Got a response (even if HTTP error) = port is open
        console.log('[API] ✓ Port is OPEN (got response)');
        return { isOpen: true };
        
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        const elapsed = Date.now() - startTime;
        const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        
        console.log('[API] Fetch error after', elapsed, 'ms:', errMsg);
        
        // Timeout = port is closed/unreachable
        if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
          console.log('[API] ✗ Port is CLOSED (connection timeout)');
          return {
            isOpen: false,
            diagnostics: {
              hostResolves: true,
              resolvedIp: isIpAddress ? undefined : resolvedIp,
              hostReachable: false,
              message: isIpAddress 
                ? `Port ${port} is closed on ${host}. Check your firewall, port forwarding, and ensure your node is running.`
                : `DNS resolves to ${resolvedIp}, but port ${port} is closed. Check your firewall, port forwarding, and ensure your node is running.`,
            },
          };
        }
        
        // Mixed content blocking on HTTPS - happens IMMEDIATELY (< 100ms)
        if (isHttpsPage && fetchErr instanceof TypeError && elapsed < 100) {
          console.log('[API] ⚠️ Mixed content blocked (HTTPS → HTTP), cannot verify port');
          return {
            isOpen: false,
            diagnostics: {
              hostResolves: true,
              resolvedIp: isIpAddress ? undefined : resolvedIp,
              hostReachable: false,
              message: `Cannot verify HTTP port from HTTPS page due to browser security. DNS resolves to ${isIpAddress ? host : resolvedIp}. Please ensure port ${port} is open and forwarded correctly.`,
            },
          };
        }
        
        // Any other error (CORS, protocol mismatch, network error) = port responded!
        if (errMsg.includes('CORS') || 
            errMsg.includes('NetworkError') || 
            errMsg.includes('Failed to fetch') ||
            errMsg.includes('ERR_') ||
            fetchErr instanceof TypeError) {
          console.log('[API] ✓ Port is OPEN (error response = port is listening)');
          return { isOpen: true };
        }
        
        // Unknown error - be conservative
        console.log('[API] ✗ Unexpected error:', errMsg);
        return {
          isOpen: false,
          diagnostics: {
            hostResolves: true,
            resolvedIp: isIpAddress ? undefined : resolvedIp,
            hostReachable: false,
            message: `Connection error: ${errMsg}`,
          },
        };
      }
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

