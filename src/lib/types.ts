/**
 * Core type definitions for the Morpheus Provider Dashboard
 */

export type Network = 'mainnet' | 'testnet';

export interface ApiConfig {
  baseUrl: string;
  username: string;
  password: string;
  network: Network;
}

export interface NetworkConfig {
  name: string;
  apiUrl: string;
  diamondContract: string;
  morTokenContract: string;
}

export interface Provider {
  Address: string;
  Endpoint: string;
  Stake: string;
  CreatedAt: string;
  IsDeleted: boolean;
}

export interface Model {
  Id: string;
  IpfsCID: string;
  Fee: number;
  Stake: string;
  Owner: string;
  Name: string;
  Tags: string[];
  CreatedAt: number;
  IsDeleted: boolean;
  ModelType?: string;
}

export interface Bid {
  Id: string;
  Provider: string;
  ModelAgentId: string;
  PricePerSecond: string;
  Nonce: string;
  CreatedAt: string;
  DeletedAt: string;
}

export interface WalletBalance {
  address: string;
  balance: string; // MOR balance in wei
  ethBalance?: string; // ETH balance in wei
}

export interface Allowance {
  allowance: string; // Amount in wei that spender can spend
}

export interface ApprovalRequest {
  spender: string; // Contract address that can spend tokens
  amount: string; // Amount in wei to approve
}

export interface ApprovalResponse {
  transaction: string; // Transaction hash or details
}

export interface ProvidersResponse {
  providers: Provider[];
}

export interface ModelsResponse {
  models: Model[];
}

export interface BidsResponse {
  bids: Bid[];
}

export interface CreateProviderRequest {
  endpoint: string;
  stake: string;
}

export interface CreateModelRequest {
  id: string;
  name: string;
  ipfsID: string;
  fee: string;
  stake: string;
  tags: string[];
}

export interface CreateBidRequest {
  modelID: string;
  pricePerSecond: string;
}

export interface ApproveRequest {
  spender: string;
  amount: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

