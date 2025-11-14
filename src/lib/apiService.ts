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
} from './types';

export class ApiService {
  private client: AxiosInstance;
  private authToken: string;

  constructor(baseUrl: string, username: string, password: string) {
    this.authToken = btoa(`${username}:${password}`);
    console.log(`[API] Initializing API Service`);
    console.log(`[API] Base URL: ${baseUrl}`);
    console.log(`[API] Username: ${username}`);
    console.log(`[API] Auth Token (Base64): ${this.authToken}`);
    
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Basic ${this.authToken}`,
      },
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        console.log(`[API] ✓ ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`);
        console.log(`[API] Response:`, response.data);
        return response;
      },
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
   * Get all bids from blockchain for the current wallet/provider
   */
  async getBids(): Promise<Bid[]> {
    // First get the wallet address
    const walletResponse = await this.client.get('/wallet');
    const address = walletResponse.data.address;
    
    // Then get bids for this provider
    const response = await this.client.get<BidsResponse>(`/blockchain/providers/${address}/bids`);
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

