/**
 * Core type definitions for the Morpheus Provider Dashboard
 */

export type Network = 'mainnet' | 'testnet';
export type Chain = 'arbitrum' | 'base';

export interface ApiConfig {
  baseUrl: string;
  username: string;
  password: string;
  network: Network;
  chain: Chain;
}

export interface NetworkConfig {
  name: string;
  apiUrl: string;
  diamondContract: string;
  morTokenContract: string;
  chainId: string;
  blockscoutApiUrl: string;
}

export interface ChainConfig {
  name: string;
  mainnet: NetworkConfig;
  testnet: NetworkConfig;
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

// Proxy Router Configuration
export interface ProxyRouterConfig {
  Version: string;
  Commit: string;
  DerivedConfig: {
    WalletAddress: string;
    ChainID: number;
    EthNodeURLs: string[];
  };
  Config: {
    Blockchain: {
      ChainID: number;
      BlockscoutApiUrl: string;
    };
    Marketplace: {
      DiamondContractAddress: string;
      MorTokenAddress: string;
    };
    Web: {
      Address: string;
      PublicUrl: string;
    };
    Environment: string;
  };
}

export interface ConfigValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  actualConfig?: {
    chainId: number;
    diamondContract: string;
    morTokenContract: string;
    Version?: string;
  };
}

// Bootstrap Configuration
export interface BootstrapConfig {
  chain: Chain;
  network: Network;
  walletPrivateKey: string;
  webPublicUrl: string;
  cookieContent?: string;
}

// Local Model Configuration (from /v1/models endpoint)
export interface LocalModel {
  Id: string;
  Name: string;
  Model: string;
  ApiType: string;
  ApiUrl: string;
  Slots: number;
  CapacityPolicy: string;
}

// The /v1/models endpoint returns an array directly
export type LocalModelsResponse = LocalModel[];

// Model Configuration for ENV generation
export interface ModelConfigEntry {
  modelId: string;
  modelName: string;
  apiType: string;
  apiUrl: string;
  apiKey?: string;
  concurrentSlots: number | '';
  capacityPolicy: string;
}

// Provider Status
export interface ProviderStatus {
  isRegistered: boolean;
  provider?: Provider;
  hasEndpoint: boolean;
  endpointReachable?: boolean;
}

// Bids comparison for model sync
export interface ModelSyncStatus {
  modelId: string;
  modelName: string;
  onBlockchain: boolean;
  onLocalNode: boolean;
  bidExists: boolean;
  needsConfiguration: boolean;
  bidId?: string; // Bid ID if a bid exists for this model
}

